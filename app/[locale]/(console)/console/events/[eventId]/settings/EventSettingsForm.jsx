'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/lib/i18n/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { LOCALES, LOCALE_NAMES } from '@/lib/i18n/locales'
import {
  Button,
  Field,
  Input,
  Textarea,
  NativeSelect,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui'
import styles from './settings.module.css'

function toLocalInput(iso, timeZone) {
  if (!iso) return ''
  // Render the stored UTC instant as the event-timezone wall clock.
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

function fromLocalInput(value, timeZone) {
  if (!value) return null
  // Interpret the wall-clock value in the event timezone → UTC instant.
  const [date, time] = value.split('T')
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm))
  // Adjust for the timezone's offset at that moment (two-pass, DST-safe enough)
  const tzDate = new Date(guess.toLocaleString('en-US', { timeZone }))
  const utcDate = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offset = utcDate.getTime() - tzDate.getTime()
  return new Date(guess.getTime() + offset).toISOString()
}

export function EventSettingsForm({ event, initialTypes, forms }) {
  const t = useTranslations('console')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const router = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [name, setName] = useState(event.name ?? {})
  const [description, setDescription] = useState(event.description ?? {})
  const [location, setLocation] = useState(event.location ?? {})
  const [slug, setSlug] = useState(event.slug)
  const [timezone, setTimezone] = useState(event.timezone)
  const [startsAt, setStartsAt] = useState(toLocalInput(event.starts_at, event.timezone))
  const [endsAt, setEndsAt] = useState(toLocalInput(event.ends_at, event.timezone))
  const [regOpens, setRegOpens] = useState(toLocalInput(event.registration_opens_at, event.timezone))
  const [regCloses, setRegCloses] = useState(toLocalInput(event.registration_closes_at, event.timezone))
  const [capacity, setCapacity] = useState(event.capacity ?? '')
  const [types, setTypes] = useState(initialTypes)
  const [saveState, setSaveState] = useState('idle')

  const timezones = Intl.supportedValuesOf?.('timeZone') ?? ['UTC']

  async function save() {
    setSaveState('saving')
    const { error } = await supabase
      .from('events')
      .update({
        name,
        description,
        location,
        slug,
        timezone,
        starts_at: fromLocalInput(startsAt, timezone),
        ends_at: fromLocalInput(endsAt, timezone),
        registration_opens_at: fromLocalInput(regOpens, timezone),
        registration_closes_at: fromLocalInput(regCloses, timezone),
        capacity: capacity === '' ? null : Number(capacity),
        supported_locales: LOCALES.filter((l) => (name[l] ?? '').trim() !== ''),
      })
      .eq('id', event.id)
    setSaveState(error ? 'error' : 'saved')
    if (!error) router.refresh()
  }

  async function setStatus(status) {
    const { error } = await supabase.from('events').update({ status }).eq('id', event.id)
    if (!error) router.refresh()
  }

  async function addType() {
    const key = `type_${Date.now().toString(36)}`
    const { data, error } = await supabase
      .from('participant_types')
      .insert({
        event_id: event.id,
        key,
        name: { en: 'New type' },
        form_id: forms[0]?.id ?? null,
        sort_order: types.length,
      })
      .select('*')
      .single()
    if (!error && data) setTypes((prev) => [...prev, data])
  }

  async function updateType(id, patch) {
    setTypes((prev) => prev.map((pt) => (pt.id === id ? { ...pt, ...patch } : pt)))
    await supabase.from('participant_types').update(patch).eq('id', id)
  }

  async function removeType(id) {
    const { error } = await supabase.from('participant_types').delete().eq('id', id)
    if (!error) setTypes((prev) => prev.filter((pt) => pt.id !== id))
  }

  return (
    <div className={styles.wrap}>
      <section className="card card-pad">
        {/* Localized content, one tab per locale */}
        <Tabs defaultValue={event.default_locale}>
          <TabsList>
            {LOCALES.map((l) => (
              <TabsTrigger key={l} value={l}>
                {LOCALE_NAMES[l]}
              </TabsTrigger>
            ))}
          </TabsList>
          {LOCALES.map((l) => (
            <TabsContent key={l} value={l}>
              <div className={styles.grid} style={{ marginTop: 'var(--s-4)' }}>
                <Field label={`${t('eventName')} (${l})`} required={l === event.default_locale}>
                  {({ id }) => (
                    <Input
                      id={id}
                      value={name[l] ?? ''}
                      onChange={(e) => setName({ ...name, [l]: e.target.value })}
                    />
                  )}
                </Field>
                <Field label={`${t('description')} (${l})`}>
                  {({ id }) => (
                    <Textarea
                      id={id}
                      value={description[l] ?? ''}
                      onChange={(e) => setDescription({ ...description, [l]: e.target.value })}
                    />
                  )}
                </Field>
                <Field label={`${t('eventName')} — ${l} · location`}>
                  {({ id }) => (
                    <Input
                      id={id}
                      value={location[l] ?? ''}
                      onChange={(e) => setLocation({ ...location, [l]: e.target.value })}
                    />
                  )}
                </Field>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </section>

      <section className="card card-pad">
        <div className={styles.grid2}>
          <Field label={t('slug')}>
            {({ id }) => <Input id={id} value={slug} onChange={(e) => setSlug(e.target.value)} />}
          </Field>
          <Field label={t('timezone')}>
            {({ id }) => (
              <NativeSelect id={id} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </NativeSelect>
            )}
          </Field>
          <Field label={t('startsAt')}>
            {({ id }) => (
              <Input id={id} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
            )}
          </Field>
          <Field label={t('endsAt')}>
            {({ id }) => (
              <Input id={id} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
            )}
          </Field>
          <Field label={t('regOpens')}>
            {({ id }) => (
              <Input id={id} type="datetime-local" value={regOpens} onChange={(e) => setRegOpens(e.target.value)} />
            )}
          </Field>
          <Field label={t('regCloses')}>
            {({ id }) => (
              <Input id={id} type="datetime-local" value={regCloses} onChange={(e) => setRegCloses(e.target.value)} />
            )}
          </Field>
          <Field label={t('capacity')} help={t('capacityHelp')}>
            {({ id }) => (
              <Input id={id} type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            )}
          </Field>
        </div>
      </section>

      <section className="card card-pad">
        <h2 style={{ marginBottom: 'var(--s-4)' }}>{t('participantTypes')}</h2>
        <div className={styles.typeList}>
          {types.map((pt) => (
            <div key={pt.id} className={styles.typeRow}>
              <Field label={t('typeKey')}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={pt.key}
                    onChange={(e) => updateType(pt.id, { key: e.target.value })}
                  />
                )}
              </Field>
              <Field label={`${t('typeName')} (${locale})`}>
                {({ id }) => (
                  <Input
                    id={id}
                    value={pt.name?.[locale] ?? pt.name?.en ?? ''}
                    onChange={(e) =>
                      updateType(pt.id, { name: { ...pt.name, [locale]: e.target.value } })
                    }
                  />
                )}
              </Field>
              <Field label={t('capacity')}>
                {({ id }) => (
                  <Input
                    id={id}
                    type="number"
                    min="1"
                    value={pt.capacity ?? ''}
                    onChange={(e) =>
                      updateType(pt.id, {
                        capacity: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                  />
                )}
              </Field>
              <Field label={t('form')}>
                {({ id }) => (
                  <NativeSelect
                    id={id}
                    value={pt.form_id ?? ''}
                    onChange={(e) => updateType(pt.id, { form_id: e.target.value || null })}
                  >
                    <option value="" />
                    {forms.map((f) => (
                      <option key={f.id} value={f.id}>{f.title}</option>
                    ))}
                  </NativeSelect>
                )}
              </Field>
              <Button variant="ghost" size="sm" onClick={() => removeType(pt.id)}>
                {t('remove')}
              </Button>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={addType} style={{ marginTop: 'var(--s-3)' }}>
          {t('addType')}
        </Button>
      </section>

      <div className={styles.footer}>
        <div className={styles.footerStatus} aria-live="polite">
          {saveState === 'saved' && <span className="badge badge-confirmed">{t('saved')}</span>}
          {saveState === 'error' && <span className="badge badge-cancelled">⚠</span>}
        </div>
        <div className={styles.footerActions}>
          {event.status === 'draft' ? (
            <Button variant="secondary" onClick={() => setStatus('published')}>
              {t('publish')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => setStatus('draft')}>
              {t('unpublish')}
            </Button>
          )}
          <Button onClick={save} disabled={saveState === 'saving'}>
            {tCommon('save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
