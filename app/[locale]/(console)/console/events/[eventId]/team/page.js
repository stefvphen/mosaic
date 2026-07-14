import { setRequestLocale } from 'next-intl/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { TeamManager } from './TeamManager'

export const dynamic = 'force-dynamic'

export default async function TeamPage({ params }) {
  const { locale, eventId } = await params
  setRequestLocale(locale)

  const supabase = await getSupabaseServerClient()
  const { data: members } = await supabase
    .from('event_organizers')
    .select('user_id, role, profiles:user_id ( full_name, email )')
    .eq('event_id', eventId)

  return <TeamManager eventId={eventId} initialMembers={members ?? []} />
}
