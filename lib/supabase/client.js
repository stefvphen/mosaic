import { createBrowserClient } from '@supabase/ssr'

// The Supabase Vercel integration renamed ANON_KEY → PUBLISHABLE_KEY in newer
// versions. Support both so the app works regardless of which one is set.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let client

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  return client
}
