import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { EventSettingsForm } from './EventSettingsForm'

export const dynamic = 'force-dynamic'

export default async function EventSettingsPage({ params }) {
  const { locale, eventId } = await params
  setRequestLocale(locale)

  const supabase = await getSupabaseServerClient()
  const [{ data: event }, { data: types }, { data: forms }] = await Promise.all([
    supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
    supabase
      .from('participant_types')
      .select('*')
      .eq('event_id', eventId)
      .order('sort_order'),
    supabase.from('forms').select('id, title').eq('event_id', eventId),
  ])
  if (!event) notFound()

  return <EventSettingsForm event={event} initialTypes={types ?? []} forms={forms ?? []} />
}
