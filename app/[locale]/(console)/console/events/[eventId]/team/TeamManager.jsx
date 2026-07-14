'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { Button, Field, Input, NativeSelect } from '@/components/ui'
import styles from './team.module.css'

export function TeamManager({ eventId, initialMembers }) {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  const [error, setError] = useState(null)

  async function add(e) {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.rpc('add_event_organizer', {
      p_event_id: eventId,
      p_email: email,
      p_role: role,
    })
    if (error) {
      setError(error.message)
    } else {
      setEmail('')
      router.refresh()
    }
  }

  async function remove(userId) {
    await supabase
      .from('event_organizers')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId)
    router.refresh()
  }

  return (
    <div className={styles.wrap}>
      <form onSubmit={add} className={styles.addRow}>
        <Field label={t('inviteByEmail')}>
          {({ id }) => (
            <Input
              id={id}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </Field>
        <NativeSelect value={role} onChange={(e) => setRole(e.target.value)} style={{ width: 'auto' }}>
          <option value="organizer">{t('roleOrganizer')}</option>
          <option value="viewer">{t('roleViewer')}</option>
        </NativeSelect>
        <Button type="submit">{tCommon('submit')}</Button>
      </form>
      {error && <p className="alert alert-error">{error}</p>}

      <div className="table-wrap" style={{ maxInlineSize: '40rem' }}>
        <table className="table">
          <tbody>
            {initialMembers.map((m) => (
              <tr key={m.user_id}>
                <td>
                  <strong>{m.profiles?.full_name || '—'}</strong>
                  <div style={{ color: 'var(--ink-soft)', fontSize: 'var(--text-xs)' }}>
                    {m.profiles?.email}
                  </div>
                </td>
                <td>{m.role === 'organizer' ? t('roleOrganizer') : t('roleViewer')}</td>
                <td style={{ textAlign: 'end' }}>
                  <Button variant="ghost" size="sm" onClick={() => remove(m.user_id)}>
                    {t('remove')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
