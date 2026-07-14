'use client'

import { useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Field } from '@/components/ui'

/**
 * File answers store a storage object path under
 * registration-files/{event_id}/{user_id}/{uuid}-{filename}.
 * The upload happens before submit; the RPC only stores the path.
 * Event id and user id come from a context set by the wizard via props.
 */
export function FileUploadField({ question: q, label, help, error, value, onChange, preview, uploadContext }) {
  const inputRef = useRef(null)
  const [state, setState] = useState('idle') // idle | uploading | error
  const supabase = getSupabaseBrowserClient()

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file || preview) return
    const maxMb = q.validation?.maxFileMb ?? 10
    if (file.size > maxMb * 1024 * 1024) {
      setState('error')
      return
    }
    const accept = q.validation?.accept
    if (Array.isArray(accept) && accept.length > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      if (!accept.map((a) => a.toLowerCase().replace(/^\./, '')).includes(ext)) {
        setState('error')
        return
      }
    }

    setState('uploading')
    const { eventId, userId } = uploadContext ?? {}
    const path = `${eventId}/${userId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g, '_')}`
    const { error: upErr } = await supabase.storage
      .from('registration-files')
      .upload(path, file)
    if (upErr) {
      setState('error')
    } else {
      setState('idle')
      onChange(path)
    }
  }

  const fileName = typeof value === 'string' ? value.split('/').pop()?.replace(/^[0-9a-f-]{36}-/, '') : null

  return (
    <Field label={label} required={q.required} help={help} error={error}>
      {({ id, describedBy, invalid }) => (
        <div>
          <input
            ref={inputRef}
            id={id}
            type="file"
            className="input"
            aria-describedby={describedBy}
            aria-invalid={invalid}
            accept={q.validation?.accept?.map((a) => `.${a.replace(/^\./, '')}`).join(',')}
            disabled={state === 'uploading' || preview}
            onChange={handleFile}
          />
          {state === 'uploading' && <p className="field-help">…</p>}
          {fileName && state === 'idle' && (
            <p className="field-help">✓ {fileName}</p>
          )}
        </div>
      )}
    </Field>
  )
}
