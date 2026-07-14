import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { redirect } from '@/lib/i18n/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { lt } from '@/lib/i18n/locales'
import { RegistrationWizard } from '@/components/wizard/RegistrationWizard'

export const dynamic = 'force-dynamic'

export default async function RegisterPage({ params }) {
  const { slug, locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('wizard')

  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect({
      href: `/login?next=${encodeURIComponent(`/${locale}/events/${slug}/register`)}`,
      locale,
    })
  }

  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()
  if (!event) notFound()

  const { data: types } = await supabase
    .from('participant_types')
    .select('id, key, name, capacity, min_per_registration, max_per_registration, sort_order, form_id, forms:form_id ( current_version_id )')
    .eq('event_id', event.id)
    .order('sort_order')
  if (!types?.length) notFound()

  const versionIds = [...new Set(types.map((pt) => pt.forms?.current_version_id).filter(Boolean))]
  const { data: versions } = await supabase
    .from('form_versions')
    .select('id, definition')
    .in('id', versionIds)
  const defById = new Map((versions ?? []).map((v) => [v.id, v.definition]))

  const participantTypes = types
    .filter((pt) => pt.forms?.current_version_id)
    .map((pt) => ({
      key: pt.key,
      name: pt.name,
      max_per_registration: pt.max_per_registration,
      definition: defById.get(pt.forms.current_version_id) ?? { questions: [] },
    }))

  return (
    <div className="container-narrow" style={{ paddingBlock: 'var(--s-6)' }}>
      <h1 className="page-title" style={{ marginBottom: 'var(--s-5)' }}>
        {t('title', { event: lt(event.name, locale, event.default_locale) })}
      </h1>
      <RegistrationWizard event={event} participantTypes={participantTypes} userId={user.id} />
    </div>
  )
}
