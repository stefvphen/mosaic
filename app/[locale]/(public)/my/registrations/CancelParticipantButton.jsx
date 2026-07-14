'use client'

import { useState } from 'react'
import { useRouter } from '@/lib/i18n/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export function CancelParticipantButton({ participantId, label, confirmText }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function cancel() {
    if (!window.confirm(confirmText)) return
    setBusy(true)
    const { error } = await getSupabaseBrowserClient().rpc('cancel_participant', {
      p_participant_id: participantId,
    })
    setBusy(false)
    if (!error) router.refresh()
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={cancel} disabled={busy}>
      {label}
    </button>
  )
}
