/** Format an ISO instant in the event's timezone for a given locale. */
export function formatEventDate(iso, timeZone, locale, opts = {}) {
  if (!iso) return ''
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone,
    ...opts,
  }).format(new Date(iso))
}

export function formatEventDateRange(startIso, endIso, timeZone, locale) {
  if (!startIso) return ''
  const fmt = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone,
  })
  return endIso ? fmt.formatRange(new Date(startIso), new Date(endIso)) : fmt.format(new Date(startIso))
}
