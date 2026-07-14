import createIntlMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'
import { routing } from './lib/i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

export async function middleware(request) {
  // Locale negotiation / redirect first — it may produce the response we
  // attach refreshed auth cookies to.
  const response = intlMiddleware(request)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session cookie if expired; must be awaited in middleware.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    // All page routes except Next internals, API routes and static files.
    '/((?!api|_next|_vercel|.*\\..*).*)',
  ],
}
