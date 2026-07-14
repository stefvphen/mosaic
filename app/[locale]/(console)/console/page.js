import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/lib/i18n/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { lt } from '@/lib/i18n/locales'
import { formatEventDateRange } from '@/lib/dates'
import { Badge } from '@/components/ui'
import { NewEventButton } from './NewEventButton'
import styles from './console.module.css'

export const dynamic = 'force-dynamic'

export default async function ConsoleHome({ params }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const supabase = await getSupabaseServerClient()
  // RLS: managers/viewers see their events (+ published ones). Show only
  // events the user can actually manage/view via event_organizers or admin.
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, status, name, default_locale, timezone, starts_at, ends_at')
    .order('starts_at', { ascending: false })

  const { data: counts } = await supabase
    .from('event_participant_counts')
    .select('event_id, status, n')

  const totals = new Map()
  for (const row of counts ?? []) {
    if (row.status === 'confirmed' || row.status === 'waitlisted') {
      totals.set(row.event_id, (totals.get(row.event_id) ?? 0) + row.n)
    }
  }

  return (
    <>
      <div className={styles.pageHead}>
        <h1 className="page-title">{t('console.events')}</h1>
        <NewEventButton label={t('console.newEvent')} />
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('console.eventName')}</th>
              <th>{t('console.startsAt')}</th>
              <th>{t('console.participants')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(events ?? []).map((event) => (
              <tr key={event.id}>
                <td>
                  <Link href={`/console/events/${event.id}`}>
                    <strong>{lt(event.name, locale, event.default_locale)}</strong>
                  </Link>
                </td>
                <td>
                  {formatEventDateRange(event.starts_at, event.ends_at, event.timezone, locale)}
                </td>
                <td>{totals.get(event.id) ?? 0}</td>
                <td>
                  <Badge tone={event.status}>{t(`status.${event.status}`)}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
