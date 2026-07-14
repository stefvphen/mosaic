import { Suspense } from 'react'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { LoginForm } from './LoginForm'

export async function generateMetadata() {
  const t = await getTranslations('auth')
  return { title: t('title') }
}

export default async function LoginPage({ params }) {
  const { locale } = await params
  setRequestLocale(locale)
  return (
    <Suspense>
      <LoginForm oktaDomain={process.env.NEXT_PUBLIC_OKTA_SSO_DOMAIN || null} />
    </Suspense>
  )
}
