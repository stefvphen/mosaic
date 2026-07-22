/** Render a stored UTC instant as a datetime-local value in the given timezone. */
export function toLocalInput(iso, timeZone) {
  if (!iso) return ''
  const d = new Date(iso)
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`
}

/** Interpret a datetime-local value as wall-clock time in the given timezone → UTC ISO. */
export function fromLocalInput(value, timeZone) {
  if (!value) return null
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

// A bad timezone/locale on a single event must never crash the page that
// lists it. Fall back to UTC (then to no timezone) instead of throwing.
function makeFormatter(locale, options) {
  try {
    return new Intl.DateTimeFormat(locale, options)
  } catch {
    try {
      return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' })
    } catch {
      const { timeZone, ...rest } = options
      try {
        return new Intl.DateTimeFormat(undefined, rest)
      } catch {
        return null
      }
    }
  }
}

// --- Per-user format overrides ---------------------------------------------
// 'auto' = the locale decides (Intl dateStyle/timeStyle — today's behaviour).
// Forced orders (dmy/mdy/ymd) are assembled from formatToParts IN THE USER'S
// LOCALE so the day-period stays localized (uk «пп», es «p. m.») — never via
// locale surrogates like en-GB. Forced output is numeric-only, so localized
// month names are not a concern.

/** h12 → true, h24 → false, auto → the locale's own convention. */
function resolveHour12(timeFormat, locale) {
  if (timeFormat === 'h12') return true
  if (timeFormat === 'h24') return false
  try {
    return new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 ?? false
  } catch {
    return false
  }
}

/** formatToParts for a forced layout; null when even the fallbacks fail. */
function forcedParts(date, timeZone, locale, { withTime, hour12 }) {
  const options = {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(withTime
      ? hour12
        ? { hour: 'numeric', minute: '2-digit', hour12: true }
        : { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
      : {}),
  }
  const fmt = makeFormatter(locale, options)
  if (!fmt) return null
  const parts = fmt.formatToParts(date)
  return (type) => parts.find((p) => p.type === type)?.value ?? ''
}

function assembleDate(get, dateFormat) {
  const d = get('day')
  const m = get('month')
  const y = get('year')
  if (dateFormat === 'mdy') return `${m}/${d}/${y}`
  if (dateFormat === 'ymd') return `${y}-${m}-${d}`
  return `${d}/${m}/${y}`
}

function assembleTime(get, hour12) {
  const base = `${get('hour')}:${get('minute')}`
  const period = hour12 ? get('dayPeriod') : ''
  return period ? `${base} ${period}` : base
}

/**
 * Format an ISO instant in the event's timezone for a given locale.
 * opts may carry {dateFormat, timeFormat} user preferences; any other keys
 * are spread into the Intl options of the auto path (backward compatible).
 */
export function formatEventDate(iso, timeZone, locale, opts = {}) {
  if (!iso) return ''
  const { dateFormat = 'auto', timeFormat = 'auto', ...intlOpts } = opts
  const date = new Date(iso)

  if (dateFormat === 'auto') {
    const clock =
      timeFormat === 'h12' ? { hour12: true } : timeFormat === 'h24' ? { hourCycle: 'h23' } : {}
    const fmt = makeFormatter(locale, {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone,
      ...clock,
      ...intlOpts,
    })
    return fmt ? fmt.format(date) : date.toISOString()
  }

  const hour12 = resolveHour12(timeFormat, locale)
  const get = forcedParts(date, timeZone, locale, { withTime: true, hour12 })
  if (!get) return date.toISOString()
  return `${assembleDate(get, dateFormat)}, ${assembleTime(get, hour12)}`
}

/** Date-only range. prefs may carry {dateFormat} (time never shown here). */
export function formatEventDateRange(startIso, endIso, timeZone, locale, prefs = {}) {
  if (!startIso) return ''
  const dateFormat = prefs.dateFormat ?? 'auto'
  const start = new Date(startIso)

  if (dateFormat === 'auto') {
    const fmt = makeFormatter(locale, { dateStyle: 'medium', timeZone })
    if (!fmt) return start.toISOString().slice(0, 10)
    return endIso ? fmt.formatRange(start, new Date(endIso)) : fmt.format(start)
  }

  const startGet = forcedParts(start, timeZone, locale, { withTime: false })
  if (!startGet) return start.toISOString().slice(0, 10)
  const startText = assembleDate(startGet, dateFormat)
  if (!endIso) return startText
  const endGet = forcedParts(new Date(endIso), timeZone, locale, { withTime: false })
  if (!endGet) return startText
  const endText = assembleDate(endGet, dateFormat)
  // Same calendar day in the event timezone → single date.
  return endText === startText ? startText : `${startText} – ${endText}`
}

/**
 * Format a date-only answer value ('YYYY-MM-DD') per the viewer's date
 * preference. Interpreted in UTC so the calendar day never shifts. Used for
 * date-type form answers so they render in each viewer's chosen format.
 */
export function formatDateValue(value, locale, prefs = {}) {
  if (typeof value !== 'string' || value === '') return ''
  return formatEventDateRange(value, null, 'UTC', locale, { dateFormat: prefs?.dateFormat })
}

// Fixed sample instant for preference option labels (localized live).
const SAMPLE_ISO = '2026-12-31T14:30:00Z'

export function formatSampleDate(dateFormat, locale) {
  return formatEventDateRange(SAMPLE_ISO, null, 'UTC', locale, { dateFormat })
}

export function formatSampleTime(timeFormat, locale) {
  if (timeFormat === 'auto') {
    const fmt = makeFormatter(locale, { timeStyle: 'short', timeZone: 'UTC' })
    return fmt ? fmt.format(new Date(SAMPLE_ISO)) : '14:30'
  }
  const hour12 = timeFormat === 'h12'
  const get = forcedParts(new Date(SAMPLE_ISO), 'UTC', locale, { withTime: true, hour12 })
  return get ? assembleTime(get, hour12) : '14:30'
}

/** Resolves 'auto' / 'dmy' / 'mdy' / 'ymd' to a concrete format ('dmy' | 'mdy' | 'ymd'). */
export function getEffectiveDateFormat(dateFormat = 'auto', locale) {
  if (dateFormat && dateFormat !== 'auto' && ['dmy', 'mdy', 'ymd'].includes(dateFormat)) {
    return dateFormat
  }
  try {
    const parts = new Intl.DateTimeFormat(locale || undefined).formatToParts(new Date(2026, 11, 31))
    const firstType = parts.find((p) => p.type === 'day' || p.type === 'month' || p.type === 'year')?.type
    if (firstType === 'month') return 'mdy'
    if (firstType === 'year') return 'ymd'
    return 'dmy'
  } catch {
    return 'dmy'
  }
}

/** Resolves 'auto' / 'h12' / 'h24' to 'h12' | 'h24'. */
export function getEffectiveTimeFormat(timeFormat = 'auto', locale) {
  if (timeFormat === 'h12') return 'h12'
  if (timeFormat === 'h24') return 'h24'
  return resolveHour12(timeFormat, locale) ? 'h12' : 'h24'
}

/** Returns date placeholder string, e.g. 'dd/mm/yyyy', 'mm/dd/yyyy', 'yyyy-mm-dd'. */
export function getDatePlaceholder(dateFormat = 'auto', locale) {
  const fmt = getEffectiveDateFormat(dateFormat, locale)
  if (fmt === 'mdy') return 'mm/dd/yyyy'
  if (fmt === 'ymd') return 'yyyy-mm-dd'
  return 'dd/mm/yyyy'
}

/** Returns datetime placeholder string, e.g. 'dd/mm/yyyy hh:mm', 'mm/dd/yyyy hh:mm AM/PM'. */
export function getDateTimePlaceholder(dateFormat = 'auto', timeFormat = 'auto', locale) {
  const dFmt = getDatePlaceholder(dateFormat, locale)
  const tFmt = getEffectiveTimeFormat(timeFormat, locale) === 'h12' ? 'hh:mm AM/PM' : 'hh:mm'
  return `${dFmt} ${tFmt}`
}

/**
 * Format an ISO date string ('YYYY-MM-DD') into user-facing text per user preferences.
 */
export function formatDateToUser(isoDate, dateFormat = 'auto', locale) {
  if (!isoDate || typeof isoDate !== 'string') return ''
  const parts = isoDate.split('-')
  if (parts.length !== 3) return isoDate
  const [y, m, d] = parts
  if (!y || !m || !d) return isoDate
  const fmt = getEffectiveDateFormat(dateFormat, locale)
  if (fmt === 'mdy') return `${m}/${d}/${y}`
  if (fmt === 'ymd') return `${y}-${m}-${d}`
  return `${d}/${m}/${y}`
}

/**
 * Parse user-typed text string into ISO date string ('YYYY-MM-DD') or null if invalid.
 */
export function parseUserDateToIso(text, dateFormat = 'auto', locale) {
  if (!text || typeof text !== 'string') return null
  const cleaned = text.trim()
  if (!cleaned) return null
  const fmt = getEffectiveDateFormat(dateFormat, locale)

  const tokens = cleaned.split(/[/.\-\s]+/).filter(Boolean)
  if (tokens.length !== 3) return null

  let y, m, d
  if (fmt === 'ymd') {
    ;[y, m, d] = tokens
  } else if (fmt === 'mdy') {
    ;[m, d, y] = tokens
  } else {
    ;[d, m, y] = tokens
  }

  const year = Number(y)
  const month = Number(m)
  const day = Number(d)

  if (
    isNaN(year) || isNaN(month) || isNaN(day) ||
    year < 1000 || year > 9999 ||
    month < 1 || month > 12 ||
    day < 1 || day > 31
  ) {
    return null
  }

  const daysInMonth = new Date(year, month, 0).getDate()
  if (day > daysInMonth) return null

  const pad = (n) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/**
 * Format a local datetime string ('YYYY-MM-DDTHH:mm') into user-facing text per user preferences.
 */
export function formatDateTimeToUser(localIso, dateFormat = 'auto', timeFormat = 'auto', locale) {
  if (!localIso || typeof localIso !== 'string') return ''
  const [datePart, timePart] = localIso.split('T')
  if (!datePart) return localIso

  const formattedDate = formatDateToUser(datePart, dateFormat, locale)
  if (!timePart) return formattedDate

  const [hhStr, mmStr] = timePart.split(':')
  if (hhStr == null || mmStr == null) return formattedDate

  const hh = Number(hhStr)
  const mm = Number(mmStr)
  if (isNaN(hh) || isNaN(mm)) return formattedDate

  const is12 = getEffectiveTimeFormat(timeFormat, locale) === 'h12'
  let timeFormatted = ''
  if (is12) {
    const period = hh >= 12 ? 'PM' : 'AM'
    const h12 = hh % 12 || 12
    timeFormatted = `${String(h12).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${period}`
  } else {
    timeFormatted = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  }

  return `${formattedDate} ${timeFormatted}`
}

/**
 * Parse user-typed datetime text into local ISO datetime string ('YYYY-MM-DDTHH:mm') or null.
 */
export function parseUserDateTimeToIso(text, dateFormat = 'auto', timeFormat = 'auto', locale) {
  if (!text || typeof text !== 'string') return null
  const cleaned = text.trim()
  if (!cleaned) return null

  let period = null
  let normalizedText = cleaned
  if (/am/i.test(cleaned)) {
    period = 'AM'
    normalizedText = cleaned.replace(/am/i, '').trim()
  } else if (/pm/i.test(cleaned)) {
    period = 'PM'
    normalizedText = cleaned.replace(/pm/i, '').trim()
  }

  const parts = normalizedText.split(/[,\sT]+/).filter(Boolean)
  if (parts.length < 1) return null

  const dateStr = parts[0]
  const isoDate = parseUserDateToIso(dateStr, dateFormat, locale)
  if (!isoDate) return null

  if (parts.length === 1) {
    return `${isoDate}T00:00`
  }

  const timeStr = parts[1]
  const timeTokens = timeStr.split(':')
  if (timeTokens.length < 2) return null

  let hh = Number(timeTokens[0])
  const mm = Number(timeTokens[1])

  if (isNaN(hh) || isNaN(mm) || mm < 0 || mm > 59) return null

  if (period) {
    if (hh < 1 || hh > 12) return null
    if (period === 'PM' && hh < 12) hh += 12
    if (period === 'AM' && hh === 12) hh = 0
  } else {
    if (hh < 0 || hh > 23) return null
  }

  const pad = (n) => String(n).padStart(2, '0')
  return `${isoDate}T${pad(hh)}:${pad(mm)}`
}
