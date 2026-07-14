import { getTranslations } from 'next-intl/server'
import { Link } from '@/lib/i18n/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { MosaicMark } from '@/components/ui'
import { LocaleSwitcher } from './LocaleSwitcher'
import { SignOutButton } from './SignOutButton'
import styles from './shell.module.css'

export async function SiteHeader() {
  const t = await getTranslations()
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isOrganizer = false
  if (user) {
    const [{ data: roles }, { data: eventRoles }] = await Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('event_organizers').select('event_id').eq('user_id', user.id).limit(1),
    ])
    isOrganizer = (roles?.length ?? 0) > 0 || (eventRoles?.length ?? 0) > 0
  }

  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.brand}>
          <MosaicMark />
          <span>{t('common.appName')}</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <Link href="/">{t('nav.events')}</Link>
          {user && <Link href="/my/registrations">{t('nav.myRegistrations')}</Link>}
          {isOrganizer && <Link href="/console">{t('nav.console')}</Link>}
        </nav>
        <div className={styles.headerActions}>
          <LocaleSwitcher label={t('common.language')} />
          {user ? (
            <SignOutButton label={t('common.signOut')} />
          ) : (
            <Link href="/login" className="btn btn-secondary btn-sm">
              {t('common.signIn')}
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
