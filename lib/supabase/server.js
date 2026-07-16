import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// The Supabase Vercel integration renamed ANON_KEY → PUBLISHABLE_KEY in newer
// versions. Support both so the app works regardless of which one is set.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component — middleware handles refresh.
        }
      },
    },
  })
}

// Anonymous client for static rendering paths (ISR) where cookies() is
// unavailable. Only sees data allowed for the anon role (published events).
export function getSupabaseAnonClient() {
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
}
