import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Link } from '@/lib/i18n/navigation'
import { getSupabaseAnonClient } from '@/lib/supabase/server'
import { lt } from '@/lib/i18n/locales'
import { formatEventDateRange } from '@/lib/dates'
import { eventPhase, EVENT_PHASE_TONES } from '@/lib/event-phase'
import { Badge, MosaicMark } from '@/components/ui'
import { getDateFormatPrefs } from '@/lib/date-format-server'
import styles from './home.module.css'

export const revalidate = 300

export default async function HomePage({ params }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations()
  const dateFmt = await getDateFormatPrefs()

  const supabase = getSupabaseAnonClient()
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, name, description, location, timezone, starts_at, ends_at, cover_image_path, default_locale, registration_opens_at, registration_closes_at')
    .eq('status', 'published')
    .eq('visibility', 'public')
    .gte('ends_at', new Date().toISOString())
    .order('starts_at', { ascending: true })

  return (
    <>
      <section className={styles.hero}>
        <div className="container">
          <div className={styles.heroMark} aria-hidden="true">
            <MosaicMark />
          </div>
          <h1 className={styles.heroTitle}>{t('home.heroTitle')}</h1>
          <p className={styles.heroSubtitle}>{t('home.heroSubtitle')}</p>
        </div>
      </section>

      <section className="container" style={{ paddingBlock: 'var(--s-6)' }}>
        <h2 className="eyebrow">{t('home.upcomingEvents')}</h2>
        {!events?.length ? (
          <p style={{ marginTop: 'var(--s-4)', color: 'var(--ink-soft)' }}>
            {t('home.noEvents')}
          </p>
        ) : (
          <ul className={styles.grid}>
            {events.map((event) => {
              const phase = eventPhase(event)
              return (
              <li key={event.id}>
                <Link href={`/events/${event.slug}`} className={styles.cardLink}>
                  <article className="card">
                    <div className={styles.cardBody}>
                      <h3>{lt(event.name, locale, event.default_locale)}</h3>
                      <p style={{ marginBlock: '0.2rem 0.4rem' }}>
                        <Badge tone={EVENT_PHASE_TONES[phase]}>{t(`eventPhase.${phase}`)}</Badge>
                      </p>
                      <p className={styles.cardMeta}>
                        {formatEventDateRange(event.starts_at, event.ends_at, event.timezone, locale, dateFmt)}
                      </p>
                      {lt(event.location, locale, event.default_locale) && (
                        <p className={styles.cardMeta}>
                          {lt(event.location, locale, event.default_locale)}
                        </p>
                      )}
                    </div>
                  </article>
                </Link>
              </li>
            )})}
          </ul>
        )}
      </section>
    </>
  )
}
