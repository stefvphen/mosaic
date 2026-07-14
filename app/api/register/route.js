import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { validateParticipantAnswers } from '@/lib/form-engine/validate'

/**
 * Authoritative registration endpoint. Re-runs the same validation the
 * browser ran (shared lib/form-engine module), prunes hidden answers, then
 * calls the atomic submit_registration RPC as the signed-in user.
 *
 * Body: { eventId, locale, participants: [{ participantTypeKey,
 *   firstName, lastName, email, answers }] }
 */
export async function POST(request) {
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'auth_required' }, { status: 401 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 })
  }

  const { eventId, locale, participants } = body ?? {}
  if (!eventId || !Array.isArray(participants) || participants.length === 0) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // Load participant types + their current published form versions (RLS lets
  // anyone read these for published events).
  const { data: types, error: typesError } = await supabase
    .from('participant_types')
    .select('id, key, form_id, forms:form_id ( id, current_version_id )')
    .eq('event_id', eventId)
  if (typesError || !types?.length) {
    return NextResponse.json({ error: 'event_not_found' }, { status: 404 })
  }

  const versionIds = [
    ...new Set(types.map((t) => t.forms?.current_version_id).filter(Boolean)),
  ]
  const { data: versions } = await supabase
    .from('form_versions')
    .select('id, definition')
    .in('id', versionIds)
  const versionById = new Map((versions ?? []).map((v) => [v.id, v]))
  const typeByKey = new Map(types.map((t) => [t.key, t]))

  // Validate every participant against their type's form definition.
  const rpcParticipants = []
  const validationErrors = []
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]
    const type = typeByKey.get(p.participantTypeKey)
    const versionId = type?.forms?.current_version_id
    const version = versionId ? versionById.get(versionId) : null
    if (!type || !version) {
      return NextResponse.json({ error: 'invalid_participant_type' }, { status: 400 })
    }
    if (!p.firstName?.trim() || !p.lastName?.trim()) {
      validationErrors.push({ index: i, errors: { _name: 'required' } })
      continue
    }
    const { valid, errors, cleaned } = validateParticipantAnswers(
      version.definition,
      type.key,
      p.answers ?? {}
    )
    if (!valid) {
      validationErrors.push({ index: i, errors })
      continue
    }
    rpcParticipants.push({
      participant_type_id: type.id,
      form_version_id: version.id,
      first_name: p.firstName.trim(),
      last_name: p.lastName.trim(),
      email: p.email?.trim() || null,
      answers: cleaned,
    })
  }

  if (validationErrors.length > 0) {
    return NextResponse.json({ error: 'validation', details: validationErrors }, { status: 422 })
  }

  // Atomic insert with capacity enforcement — runs as the signed-in user.
  const { data, error } = await supabase.rpc('submit_registration', {
    p_event_id: eventId,
    p_locale: locale ?? 'en',
    p_participants: rpcParticipants,
  })
  if (error) {
    const known = ['registration is closed', 'registration has not opened yet', 'event not open for registration']
    const status = known.some((m) => error.message?.includes(m)) ? 409 : 500
    return NextResponse.json({ error: error.message }, { status })
  }

  return NextResponse.json(data)
}
