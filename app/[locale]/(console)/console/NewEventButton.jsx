'use client'

import { useRouter } from '@/lib/i18n/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

/** Creates a draft event with sane defaults and jumps to its settings. */
export function NewEventButton({ label }) {
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  async function create() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { data: org } = await supabase.from('organizations').select('id').limit(1).single()

    const slug = `event-${Date.now().toString(36)}`
    const start = new Date(Date.now() + 30 * 86400_000)
    const end = new Date(start.getTime() + 2 * 86400_000)

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        org_id: org.id,
        slug,
        name: { en: 'Untitled event' },
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        created_by: user.id,
      })
      .select('id')
      .single()

    if (!error && event) {
      // Every event gets a default form so participant types can point at it.
      const { data: form } = await supabase
        .from('forms')
        .insert({ event_id: event.id, title: 'Registration form' })
        .select('id')
        .single()
      if (form) {
        await supabase.rpc('create_draft_version', { p_form_id: form.id })
      }
      router.push(`/console/events/${event.id}/settings`)
    }
  }

  return (
    <button className="btn btn-primary" onClick={create}>
      {label}
    </button>
  )
}
