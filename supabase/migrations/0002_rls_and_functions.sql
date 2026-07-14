-- Mosaic RLS policies, role helpers, registration RPC, waitlist promotion, storage.

-- ---------------------------------------------------------------------------
-- Role helper functions (security definer avoids recursive RLS)
-- ---------------------------------------------------------------------------
create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function private.is_global_organizer()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from user_roles
    where user_id = auth.uid() and role in ('admin', 'organizer')
  );
$$;

create or replace function private.can_manage_event(eid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select private.is_admin() or exists (
    select 1 from event_organizers
    where event_id = eid and user_id = auth.uid() and role = 'organizer'
  );
$$;

create or replace function private.can_view_event(eid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select private.can_manage_event(eid) or exists (
    select 1 from event_organizers
    where event_id = eid and user_id = auth.uid()
  );
$$;

grant usage on schema private to authenticated, anon;
grant execute on function private.is_admin() to authenticated;
grant execute on function private.is_global_organizer() to authenticated;
grant execute on function private.can_manage_event(uuid) to authenticated;
grant execute on function private.can_view_event(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table profiles enable row level security;
alter table user_roles enable row level security;
alter table events enable row level security;
alter table event_organizers enable row level security;
alter table forms enable row level security;
alter table form_versions enable row level security;
alter table participant_types enable row level security;
alter table registrations enable row level security;
alter table participants enable row level security;
alter table participant_status_history enable row level security;

-- organizations: readable by all authenticated; admin manages
create policy org_select on organizations for select to authenticated using (true);
create policy org_update on organizations for update to authenticated
  using (private.is_admin());

-- profiles: self + admin read; self update
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or private.is_admin());
create policy profiles_update on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_roles: self + admin read; admin manages
create policy user_roles_select on user_roles for select to authenticated
  using (user_id = auth.uid() or private.is_admin());
create policy user_roles_insert on user_roles for insert to authenticated
  with check (private.is_admin());
create policy user_roles_update on user_roles for update to authenticated
  using (private.is_admin());
create policy user_roles_delete on user_roles for delete to authenticated
  using (private.is_admin());

-- events: published visible to everyone (incl. anon); drafts to their team
create policy events_select_public on events for select to anon, authenticated
  using (status = 'published' or private.can_view_event(id));
create policy events_insert on events for insert to authenticated
  with check (private.is_global_organizer() and created_by = auth.uid());
create policy events_update on events for update to authenticated
  using (private.can_manage_event(id));
create policy events_delete on events for delete to authenticated
  using (private.is_admin());

-- event_organizers
create policy event_org_select on event_organizers for select to authenticated
  using (private.can_view_event(event_id) or user_id = auth.uid());
create policy event_org_insert on event_organizers for insert to authenticated
  with check (private.can_manage_event(event_id));
create policy event_org_update on event_organizers for update to authenticated
  using (private.can_manage_event(event_id));
create policy event_org_delete on event_organizers for delete to authenticated
  using (private.can_manage_event(event_id));

-- forms / form_versions / participant_types:
-- public read iff parent event is published (anonymous visitors must render forms);
-- writes for event managers; published form versions are immutable.
create or replace function private.event_is_published(eid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from events where id = eid and status = 'published');
$$;
grant execute on function private.event_is_published(uuid) to authenticated, anon;

create policy forms_select on forms for select to anon, authenticated
  using (private.event_is_published(event_id) or private.can_view_event(event_id));
create policy forms_insert on forms for insert to authenticated
  with check (private.can_manage_event(event_id));
create policy forms_update on forms for update to authenticated
  using (private.can_manage_event(event_id));
create policy forms_delete on forms for delete to authenticated
  using (private.can_manage_event(event_id));

create or replace function private.can_view_form(fid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from forms f
    where f.id = fid
      and (private.event_is_published(f.event_id) or private.can_view_event(f.event_id))
  );
$$;
create or replace function private.can_manage_form(fid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from forms f
    where f.id = fid and private.can_manage_event(f.event_id)
  );
$$;
grant execute on function private.can_view_form(uuid) to authenticated, anon;
grant execute on function private.can_manage_form(uuid) to authenticated;

create policy form_versions_select on form_versions for select to anon, authenticated
  using (private.can_view_form(form_id));
create policy form_versions_insert on form_versions for insert to authenticated
  with check (private.can_manage_form(form_id));
-- Immutability: only unpublished (draft) versions can change.
create policy form_versions_update on form_versions for update to authenticated
  using (private.can_manage_form(form_id) and published_at is null);
create policy form_versions_delete on form_versions for delete to authenticated
  using (private.can_manage_form(form_id) and published_at is null);

create policy ptypes_select on participant_types for select to anon, authenticated
  using (private.event_is_published(event_id) or private.can_view_event(event_id));
create policy ptypes_insert on participant_types for insert to authenticated
  with check (private.can_manage_event(event_id));
create policy ptypes_update on participant_types for update to authenticated
  using (private.can_manage_event(event_id));
create policy ptypes_delete on participant_types for delete to authenticated
  using (private.can_manage_event(event_id));

-- registrations / participants: reads by owner or event team.
-- NO insert policies — all creation flows through the submit_registration RPC.
create policy registrations_select on registrations for select to authenticated
  using (registered_by = auth.uid() or private.can_view_event(event_id));

create policy participants_select on participants for select to authenticated
  using (
    private.can_view_event(event_id)
    or exists (
      select 1 from registrations r
      where r.id = registration_id and r.registered_by = auth.uid()
    )
  );
-- Organizers may change status (and only via the console; answer edits by
-- registrants go through an RPC in a later milestone).
create policy participants_update on participants for update to authenticated
  using (private.can_manage_event(event_id));

create policy status_history_select on participant_status_history for select to authenticated
  using (exists (
    select 1 from participants p
    where p.id = participant_id and private.can_view_event(p.event_id)
  ));

-- ---------------------------------------------------------------------------
-- Atomic registration submission.
-- Row-locks the involved participant_types rows (ordered) and the events row
-- so concurrent submissions serialize; overselling is impossible.
-- p_participants: [{participant_type_id, form_version_id, first_name,
--                   last_name, email, answers}]
-- ---------------------------------------------------------------------------
create or replace function public.submit_registration(
  p_event_id uuid,
  p_locale text,
  p_participants jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event events%rowtype;
  v_registration_id uuid;
  v_p jsonb;
  v_type participant_types%rowtype;
  v_status participant_status;
  v_confirmed_for_type integer;
  v_confirmed_for_event integer;
  v_new_id uuid;
  v_results jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) = 0 then
    raise exception 'no participants supplied';
  end if;
  if jsonb_array_length(p_participants) > 25 then
    raise exception 'too many participants in one registration';
  end if;

  select * into v_event from events where id = p_event_id;
  if not found or v_event.status <> 'published' then
    raise exception 'event not open for registration';
  end if;
  if v_event.registration_opens_at is not null and now() < v_event.registration_opens_at then
    raise exception 'registration has not opened yet';
  end if;
  if v_event.registration_closes_at is not null and now() > v_event.registration_closes_at then
    raise exception 'registration is closed';
  end if;

  -- Serialize concurrent submissions: lock involved type rows in id order,
  -- then the event row when event-wide capacity applies.
  perform 1 from participant_types
    where id in (
      select distinct (x->>'participant_type_id')::uuid
      from jsonb_array_elements(p_participants) x
    )
    order by id
    for update;
  if v_event.capacity is not null then
    perform 1 from events where id = p_event_id for update;
  end if;

  insert into registrations (event_id, registered_by, locale)
  values (p_event_id, v_uid, coalesce(p_locale, 'en'))
  returning id into v_registration_id;

  for v_p in select * from jsonb_array_elements(p_participants) loop
    select * into v_type from participant_types
      where id = (v_p->>'participant_type_id')::uuid and event_id = p_event_id;
    if not found then
      raise exception 'invalid participant type';
    end if;
    if v_type.form_id is null
       or not exists (
         select 1 from form_versions fv
         where fv.id = (v_p->>'form_version_id')::uuid
           and fv.form_id = v_type.form_id
           and fv.published_at is not null
       ) then
      raise exception 'invalid form version for participant type %', v_type.key;
    end if;

    select count(*) into v_confirmed_for_type
      from participants
      where participant_type_id = v_type.id and status = 'confirmed';
    select count(*) into v_confirmed_for_event
      from participants
      where event_id = p_event_id and status = 'confirmed';

    if (v_type.capacity is not null and v_confirmed_for_type >= v_type.capacity)
       or (v_event.capacity is not null and v_confirmed_for_event >= v_event.capacity) then
      v_status := 'waitlisted';
    else
      v_status := 'confirmed';
    end if;

    insert into participants (
      registration_id, event_id, participant_type_id, form_version_id,
      status, first_name, last_name, email, answers, waitlisted_at
    ) values (
      v_registration_id, p_event_id, v_type.id,
      (v_p->>'form_version_id')::uuid,
      v_status,
      v_p->>'first_name', v_p->>'last_name', nullif(v_p->>'email', ''),
      coalesce(v_p->'answers', '{}'::jsonb),
      case when v_status = 'waitlisted' then now() end
    ) returning id into v_new_id;

    v_results := v_results || jsonb_build_object(
      'participant_id', v_new_id,
      'first_name', v_p->>'first_name',
      'status', v_status
    );
  end loop;

  return jsonb_build_object('registration_id', v_registration_id, 'participants', v_results);
end;
$$;

revoke execute on function public.submit_registration(uuid, text, jsonb) from public, anon;
grant execute on function public.submit_registration(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Registrant-initiated cancellation (own participant only)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_participant(p_participant_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update participants p
  set status = 'cancelled'
  from registrations r
  where p.id = p_participant_id
    and r.id = p.registration_id
    and r.registered_by = auth.uid()
    and p.status <> 'cancelled';
  if not found then
    raise exception 'participant not found or not yours';
  end if;
end;
$$;
revoke execute on function public.cancel_participant(uuid) from public, anon;
grant execute on function public.cancel_participant(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Waitlist promotion: when a confirmed participant is cancelled, promote the
-- oldest waitlisted participant of the same type (under the same locks).
-- ---------------------------------------------------------------------------
create or replace function private.promote_from_waitlist()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_event events%rowtype;
  v_type participant_types%rowtype;
  v_confirmed_for_type integer;
  v_confirmed_for_event integer;
  v_candidate uuid;
begin
  if not (old.status = 'confirmed' and new.status = 'cancelled') then
    return new;
  end if;

  select * into v_type from participant_types
    where id = new.participant_type_id for update;
  select * into v_event from events where id = new.event_id;
  if v_event.capacity is not null then
    perform 1 from events where id = new.event_id for update;
  end if;

  select count(*) into v_confirmed_for_type
    from participants
    where participant_type_id = new.participant_type_id and status = 'confirmed';
  select count(*) into v_confirmed_for_event
    from participants
    where event_id = new.event_id and status = 'confirmed';

  if (v_type.capacity is null or v_confirmed_for_type < v_type.capacity)
     and (v_event.capacity is null or v_confirmed_for_event < v_event.capacity) then
    select id into v_candidate
      from participants
      where participant_type_id = new.participant_type_id
        and status = 'waitlisted'
      order by waitlisted_at asc nulls last
      limit 1
      for update skip locked;
    if v_candidate is not null then
      update participants
      set status = 'confirmed', waitlisted_at = null
      where id = v_candidate;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_participant_cancelled
  after update of status on participants
  for each row execute function private.promote_from_waitlist();

-- ---------------------------------------------------------------------------
-- Form publishing: clone-on-edit helpers.
-- publish_form_version marks the draft published and points the form at it.
-- create_draft_version clones the current version's definition into a new draft.
-- ---------------------------------------------------------------------------
create or replace function public.publish_form_version(p_version_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_form_id uuid;
begin
  select form_id into v_form_id from form_versions where id = p_version_id;
  if v_form_id is null or not private.can_manage_form(v_form_id) then
    raise exception 'not allowed';
  end if;
  update form_versions set published_at = now()
    where id = p_version_id and published_at is null;
  if not found then
    raise exception 'version not found or already published';
  end if;
  update forms set current_version_id = p_version_id where id = v_form_id;
end;
$$;
revoke execute on function public.publish_form_version(uuid) from public, anon;
grant execute on function public.publish_form_version(uuid) to authenticated;

create or replace function public.create_draft_version(p_form_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_id uuid;
begin
  if not private.can_manage_form(p_form_id) then
    raise exception 'not allowed';
  end if;
  -- Reuse an existing draft if one exists.
  select id into v_new_id from form_versions
    where form_id = p_form_id and published_at is null
    order by version desc limit 1;
  if v_new_id is not null then
    return v_new_id;
  end if;
  insert into form_versions (form_id, version, definition, created_by)
  select p_form_id,
         coalesce(max(version), 0) + 1,
         coalesce(
           (select definition from form_versions fv2
            where fv2.form_id = p_form_id and fv2.published_at is not null
            order by fv2.version desc limit 1),
           '{"questions": []}'::jsonb
         ),
         auth.uid()
  from form_versions where form_id = p_form_id
  returning id into v_new_id;
  return v_new_id;
end;
$$;
revoke execute on function public.create_draft_version(uuid) from public, anon;
grant execute on function public.create_draft_version(uuid) to authenticated;

-- Organizers can see profile names of people on event teams they can view.
create policy profiles_select_team on profiles for select to authenticated
  using (exists (
    select 1 from event_organizers eo
    where eo.user_id = profiles.id and private.can_view_event(eo.event_id)
  ));

-- Add a team member by email (email lookup needs definer rights).
create or replace function public.add_event_organizer(
  p_event_id uuid, p_email text, p_role event_role
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid;
begin
  if not private.can_manage_event(p_event_id) then
    raise exception 'not allowed';
  end if;
  select id into v_user from profiles where lower(email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'no user with that email';
  end if;
  insert into event_organizers (event_id, user_id, role, granted_by)
  values (p_event_id, v_user, p_role, auth.uid())
  on conflict (event_id, user_id) do update set role = excluded.role;
end;
$$;
revoke execute on function public.add_event_organizer(uuid, text, event_role) from public, anon;
grant execute on function public.add_event_organizer(uuid, text, event_role) to authenticated;

-- API-facing wrapper so server routes can ask "may this user view event X?"
create or replace function public.can_view_event_api(eid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select private.can_view_event(eid);
$$;
revoke execute on function public.can_view_event_api(uuid) from public, anon;
grant execute on function public.can_view_event_api(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets and policies
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('event-covers', 'event-covers', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/avif']),
  ('registration-files', 'registration-files', false, 10485760, null)
on conflict (id) do nothing;

-- event-covers: public read; writes for event managers (path: {event_id}/...)
create policy covers_read on storage.objects for select
  using (bucket_id = 'event-covers');
create policy covers_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-covers'
    and private.can_manage_event(((storage.foldername(name))[1])::uuid)
  );
create policy covers_update on storage.objects for update to authenticated
  using (
    bucket_id = 'event-covers'
    and private.can_manage_event(((storage.foldername(name))[1])::uuid)
  );
create policy covers_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-covers'
    and private.can_manage_event(((storage.foldername(name))[1])::uuid)
  );

-- registration-files: path {event_id}/{user_id}/{uuid}-{filename}
-- Registrants upload under their own user id before submit; the answer stores
-- the object path. Event team + owner can read.
create policy regfiles_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'registration-files'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
create policy regfiles_read on storage.objects for select to authenticated
  using (
    bucket_id = 'registration-files'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or private.can_view_event(((storage.foldername(name))[1])::uuid)
    )
  );
create policy regfiles_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'registration-files'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
