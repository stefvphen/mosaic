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
