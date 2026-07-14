'use client'

import { useRouter } from '@/lib/i18n/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export function SignOutButton({ label }) {
  const router = useRouter()

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut()
    router.refresh()
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={signOut}>
      {label}
    </button>
  )
}
