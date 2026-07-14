-- Mosaic core schema
-- All timestamps are UTC instants (timestamptz); events carry an IANA timezone for display.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Tenancy hedge: single seeded organization, org_id on top-level tables.
-- ---------------------------------------------------------------------------
create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users, created by trigger)
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid references organizations(id),
  full_name text,
  email text not null,
  preferred_locale text not null default 'en'
    check (preferred_locale in ('en','es','fr','ru','uk')),
  created_at timestamptz not null default now()
);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, org_id, full_name, email, preferred_locale)
  values (
    new.id,
    (select id from public.organizations order by created_at limit 1),
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email,
    coalesce(nullif(new.raw_user_meta_data->>'locale',''), 'en')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Roles: global (admin / organizer) + per-event (organizer / viewer)
-- ---------------------------------------------------------------------------
create type global_role as enum ('admin', 'organizer');

create table user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id),
  role global_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create type event_status as enum ('draft', 'published', 'archived');

create table events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  slug text unique not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  status event_status not null default 'draft',
  name jsonb not null,
  description jsonb not null default '{}',
  location jsonb not null default '{}',
  timezone text not null default 'UTC',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  capacity integer check (capacity is null or capacity > 0),
  cover_image_path text,
  default_locale text not null default 'en'
    check (default_locale in ('en','es','fr','ru','uk')),
  supported_locales text[] not null default '{en}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (name ? default_locale)
);

create type event_role as enum ('organizer', 'viewer');

create table event_organizers (
  event_id uuid not null references events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role event_role not null,
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- Event creator is automatically its organizer.
create or replace function private.grant_creator_event_role()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.event_organizers (event_id, user_id, role, granted_by)
  values (new.id, new.created_by, 'organizer', new.created_by)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_event_created
  after insert on events
  for each row execute function private.grant_creator_event_role();

-- ---------------------------------------------------------------------------
-- Forms and immutable published versions.
-- The whole form definition (questions, conditional logic, localized labels)
-- lives in form_versions.definition as one JSONB document.
-- ---------------------------------------------------------------------------
create table forms (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  current_version_id uuid,
  created_at timestamptz not null default now()
);

create table form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references forms(id) on delete cascade,
  version integer not null,
  definition jsonb not null default '{"questions": []}',
  published_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (form_id, version)
);

alter table forms
  add constraint forms_current_version_fk
  foreign key (current_version_id) references form_versions(id);

-- ---------------------------------------------------------------------------
-- Participant types (relational: capacity enforcement needs row locks)
-- ---------------------------------------------------------------------------
create table participant_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  name jsonb not null,
  capacity integer check (capacity is null or capacity > 0),
  min_per_registration integer not null default 0,
  max_per_registration integer not null default 10,
  form_id uuid references forms(id),
  min_age integer,
  max_age integer,
  rules jsonb not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, key)
);

-- ---------------------------------------------------------------------------
-- Registrations (the "cart") and participants (people)
-- ---------------------------------------------------------------------------
create type participant_status as enum ('pending','confirmed','waitlisted','cancelled');

create table registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  registered_by uuid not null references auth.users(id),
  locale text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table participants (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references registrations(id) on delete cascade,
  event_id uuid not null references events(id),
  participant_type_id uuid not null references participant_types(id),
  form_version_id uuid not null references form_versions(id),
  status participant_status not null default 'pending',
  first_name text not null,
  last_name text not null,
  email text,
  answers jsonb not null default '{}',
  waitlisted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index participants_answers_gin on participants using gin (answers jsonb_path_ops);
create index participants_event_status on participants (event_id, status);
create index participants_type_status on participants (participant_type_id, status);
create index participants_registration on participants (registration_id);
create index registrations_event on registrations (event_id);
create index registrations_registered_by on registrations (registered_by);

-- ---------------------------------------------------------------------------
-- Status audit trail
-- ---------------------------------------------------------------------------
create table participant_status_history (
  id bigint generated always as identity primary key,
  participant_id uuid not null references participants(id) on delete cascade,
  old_status participant_status,
  new_status participant_status not null,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now()
);

create or replace function private.log_participant_status_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.participant_status_history (participant_id, old_status, new_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.participant_status_history (participant_id, old_status, new_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger on_participant_status_change
  after insert or update of status on participants
  for each row execute function private.log_participant_status_change();

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function private.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_events before update on events
  for each row execute function private.touch_updated_at();
create trigger touch_registrations before update on registrations
  for each row execute function private.touch_updated_at();
create trigger touch_participants before update on participants
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Dashboard counts
-- ---------------------------------------------------------------------------
create view event_participant_counts
with (security_invoker = true) as
select event_id, participant_type_id, status, count(*)::integer as n
from participants
group by 1, 2, 3;
