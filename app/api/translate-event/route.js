import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  ru: 'Russian',
  uk: 'Ukrainian',
}

// Translate a batch of short event-content strings from one language to
// another using Claude. Returns the translations in the same order.
async function translateBatch(strings, sourceLang, targetLang, apiKey) {
  const system =
    `You are a professional translator for an event website. Translate each string ` +
    `in the given JSON array from ${sourceLang} to ${targetLang}. Preserve meaning, ` +
    `tone, line breaks, punctuation, emoji and any placeholders like {date}. Do not ` +
    `translate proper names, brand names, URLs or email addresses. Return ONLY a JSON ` +
    `array of translated strings, same length and order, no commentary.`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: JSON.stringify(strings) }],
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`Anthropic API error ${res.status}: ${detail.slice(0, 200)}`)
  }

  const data = await res.json()
  const text = data?.content?.[0]?.text ?? ''
  const match = text.match(/\[[\s\S]*\]/)
  const arr = JSON.parse(match ? match[0] : text)
  if (!Array.isArray(arr) || arr.length !== strings.length) {
    throw new Error('Unexpected translation response shape')
  }
  return arr.map((s) => (typeof s === 'string' ? s : String(s)))
}

export async function POST(request) {
  // Require an authenticated organizer to avoid anonymous API abuse/cost.
  const supabase = await getSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'no_api_key' }, { status: 400 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const { strings, source, targets } = body ?? {}
  if (
    !Array.isArray(strings) ||
    typeof source !== 'string' ||
    !Array.isArray(targets) ||
    !LANGUAGE_NAMES[source]
  ) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
  if (strings.length === 0 || targets.length === 0) {
    return NextResponse.json({ translations: {} })
  }
  if (strings.length > 300) {
    return NextResponse.json({ error: 'too_many_strings' }, { status: 400 })
  }

  const translations = {}
  try {
    for (const target of targets) {
      if (!LANGUAGE_NAMES[target] || target === source) continue
      translations[target] = await translateBatch(
        strings,
        LANGUAGE_NAMES[source],
        LANGUAGE_NAMES[target],
        apiKey
      )
    }
  } catch (e) {
    return NextResponse.json({ error: 'translation_failed', detail: String(e.message) }, { status: 502 })
  }

  return NextResponse.json({ translations })
}
