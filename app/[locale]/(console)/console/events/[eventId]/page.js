import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { lt } from '@/lib/i18n/locales'
import styles from '../../console.module.css'

export const dynamic = 'force-dynamic'

export default async function EventOverview({ params }) {
  const { locale, eventId } = await params
  setRequestLocale(locale)
  const t = await getTranslations()

  const supabase = await getSupabaseServerClient()
  const [{ data: counts }, { data: types }] = await Promise.all([
    supabase.from('event_participant_counts').select('*').eq('event_id', eventId),
    supabase
      .from('participant_types')
      .select('id, key, name, capacity, sort_order')
      .eq('event_id', eventId)
      .order('sort_order'),
  ])

  const byStatus = {}
  const byType = new Map()
  for (const row of counts ?? []) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + row.n
    if (row.status === 'confirmed') {
      byType.set(row.participant_type_id, (byType.get(row.participant_type_id) ?? 0) + row.n)
    }
  }
  const total = (byStatus.confirmed ?? 0) + (byStatus.waitlisted ?? 0)

  return (
    <>
      <div className={styles.statGrid}>
        <div className={`card ${styles.stat}`}>
          <div className={styles.statValue}>{total}</div>
          <div className={styles.statLabel}>{t('console.totalRegistered')}</div>
        </div>
        {['confirmed', 'waitlisted', 'cancelled'].map((status) => (
          <div key={status} className={`card ${styles.stat}`}>
            <div className={styles.statValue}>{byStatus[status] ?? 0}</div>
            <div className={styles.statLabel}>{t(`status.${status}`)}</div>
          </div>
        ))}
      </div>

      <h2 className="eyebrow" style={{ marginBottom: 'var(--s-3)' }}>
        {t('console.byType')}
      </h2>
      <div className="table-wrap" style={{ maxInlineSize: '36rem' }}>
        <table className="table">
          <tbody>
            {(types ?? []).map((pt) => (
              <tr key={pt.id}>
                <td>{lt(pt.name, locale)}</td>
                <td style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
                  {byType.get(pt.id) ?? 0}
                  {pt.capacity != null && ` / ${pt.capacity}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
