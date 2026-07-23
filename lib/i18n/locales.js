export const LOCALES = ['en', 'es', 'fr', 'ru', 'uk']
export const DEFAULT_LOCALE = 'en'

export const LOCALE_NAMES = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  ru: 'Русский',
  uk: 'Українська',
}

/**
 * Resolve a localized JSONB value ({en: "...", es: "..."}) to a string.
 * Falls back: requested locale → fallback locale → first available.
 */
export function lt(value, locale, fallbackLocale = DEFAULT_LOCALE) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return value[locale] ?? value[fallbackLocale] ?? Object.values(value)[0] ?? ''
}

/**
 * The languages an event is offered in, in canonical LOCALES order.
 * Drops any unknown codes and falls back to the event's default locale
 * (or the app default) when supported_locales is empty/missing.
 */
export function eventLocales(event) {
  const list = Array.isArray(event?.supported_locales) ? event.supported_locales : []
  const filtered = LOCALES.filter((l) => list.includes(l))
  return filtered.length ? filtered : [event?.default_locale ?? DEFAULT_LOCALE]
}
