'use client'

import { useState, useEffect, useRef, useId } from 'react'
import { useLocale } from 'next-intl'
import { useDateFormatPrefs } from '@/components/providers/DateFormatProvider'
import {
  getDatePlaceholder,
  getDateTimePlaceholder,
  formatDateToUser,
  parseUserDateToIso,
  formatDateTimeToUser,
  parseUserDateTimeToIso,
} from '@/lib/dates'
import styles from './DateInput.module.css'

/**
 * Custom Date Input that displays and expects date input formatted according
 * to the user's profile date format preference (dmy, mdy, ymd, auto).
 *
 * Emits canonical ISO 'YYYY-MM-DD' to `onChange`.
 */
export function DateInput({
  value = '',
  onChange,
  id: customId,
  dateFormat: overrideDateFormat,
  locale: overrideLocale,
  placeholder: customPlaceholder,
  className = '',
  disabled = false,
  readOnly = false,
  preview = false,
  ...props
}) {
  const defaultId = useId()
  const id = customId || defaultId
  const prefs = useDateFormatPrefs()
  const currentLocale = useLocale()
  const dateFormat = overrideDateFormat ?? prefs?.dateFormat ?? 'auto'
  const locale = overrideLocale ?? currentLocale

  const effectivePlaceholder = customPlaceholder ?? getDatePlaceholder(dateFormat, locale)

  const [textValue, setTextValue] = useState(() =>
    value ? formatDateToUser(value, dateFormat, locale) : ''
  )
  const [isFocused, setIsFocused] = useState(false)
  const nativePickerRef = useRef(null)

  useEffect(() => {
    if (!isFocused) {
      setTextValue(value ? formatDateToUser(value, dateFormat, locale) : '')
    }
  }, [value, dateFormat, locale, isFocused])

  function handleTextChange(e) {
    const text = e.target.value
    setTextValue(text)
    if (!text.trim()) {
      onChange?.('')
      return
    }
    const iso = parseUserDateToIso(text, dateFormat, locale)
    if (iso) {
      onChange?.(iso)
    } else {
      onChange?.('')
    }
  }

  function handleBlur() {
    setIsFocused(false)
    if (!textValue.trim()) {
      onChange?.('')
      setTextValue('')
      return
    }
    const iso = parseUserDateToIso(textValue, dateFormat, locale)
    if (iso) {
      setTextValue(formatDateToUser(iso, dateFormat, locale))
      onChange?.(iso)
    }
  }

  function handlePickerChange(e) {
    const iso = e.target.value
    if (iso) {
      setTextValue(formatDateToUser(iso, dateFormat, locale))
      onChange?.(iso)
    }
  }

  function triggerPicker() {
    if (disabled || readOnly || preview) return
    try {
      if (nativePickerRef.current?.showPicker) {
        nativePickerRef.current.showPicker()
      } else {
        nativePickerRef.current?.click()
      }
    } catch {
      nativePickerRef.current?.focus()
    }
  }

  return (
    <div className={`${styles.dateInputContainer} ${disabled ? styles.disabled : ''}`}>
      <input
        id={id}
        type="text"
        className={`input ${styles.dateInputText} ${className}`}
        value={textValue}
        placeholder={effectivePlaceholder}
        onChange={handleTextChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly || preview}
        {...props}
      />
      <input
        ref={nativePickerRef}
        type="date"
        className={styles.nativeHiddenPicker}
        value={value || ''}
        onChange={handlePickerChange}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || readOnly || preview}
      />
      <button
        type="button"
        className={styles.pickerButton}
        onClick={triggerPicker}
        tabIndex={-1}
        aria-label="Calendar picker"
        disabled={disabled || readOnly || preview}
      >
        📅
      </button>
    </div>
  )
}

/**
 * Custom DateTime Input that displays and expects datetime input formatted
 * according to the user's profile date/time format preferences.
 *
 * Emits canonical local ISO 'YYYY-MM-DDTHH:mm' to `onChange`.
 */
export function DateTimeInput({
  value = '',
  onChange,
  id: customId,
  dateFormat: overrideDateFormat,
  timeFormat: overrideTimeFormat,
  locale: overrideLocale,
  placeholder: customPlaceholder,
  className = '',
  disabled = false,
  readOnly = false,
  ...props
}) {
  const defaultId = useId()
  const id = customId || defaultId
  const prefs = useDateFormatPrefs()
  const currentLocale = useLocale()
  const dateFormat = overrideDateFormat ?? prefs?.dateFormat ?? 'auto'
  const timeFormat = overrideTimeFormat ?? prefs?.timeFormat ?? 'auto'
  const locale = overrideLocale ?? currentLocale

  const effectivePlaceholder =
    customPlaceholder ?? getDateTimePlaceholder(dateFormat, timeFormat, locale)

  const [textValue, setTextValue] = useState(() =>
    value ? formatDateTimeToUser(value, dateFormat, timeFormat, locale) : ''
  )
  const [isFocused, setIsFocused] = useState(false)
  const nativePickerRef = useRef(null)

  useEffect(() => {
    if (!isFocused) {
      setTextValue(value ? formatDateTimeToUser(value, dateFormat, timeFormat, locale) : '')
    }
  }, [value, dateFormat, timeFormat, locale, isFocused])

  function handleTextChange(e) {
    const text = e.target.value
    setTextValue(text)
    if (!text.trim()) {
      onChange?.('')
      return
    }
    const iso = parseUserDateTimeToIso(text, dateFormat, timeFormat, locale)
    if (iso) {
      onChange?.(iso)
    } else {
      onChange?.('')
    }
  }

  function handleBlur() {
    setIsFocused(false)
    if (!textValue.trim()) {
      onChange?.('')
      setTextValue('')
      return
    }
    const iso = parseUserDateTimeToIso(textValue, dateFormat, timeFormat, locale)
    if (iso) {
      setTextValue(formatDateTimeToUser(iso, dateFormat, timeFormat, locale))
      onChange?.(iso)
    }
  }

  function handlePickerChange(e) {
    const iso = e.target.value
    if (iso) {
      setTextValue(formatDateTimeToUser(iso, dateFormat, timeFormat, locale))
      onChange?.(iso)
    }
  }

  function triggerPicker() {
    if (disabled || readOnly) return
    try {
      if (nativePickerRef.current?.showPicker) {
        nativePickerRef.current.showPicker()
      } else {
        nativePickerRef.current?.click()
      }
    } catch {
      nativePickerRef.current?.focus()
    }
  }

  return (
    <div className={`${styles.dateInputContainer} ${disabled ? styles.disabled : ''}`}>
      <input
        id={id}
        type="text"
        className={`input ${styles.dateInputText} ${className}`}
        value={textValue}
        placeholder={effectivePlaceholder}
        onChange={handleTextChange}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        disabled={disabled}
        readOnly={readOnly}
        {...props}
      />
      <input
        ref={nativePickerRef}
        type="datetime-local"
        className={styles.nativeHiddenPicker}
        value={value || ''}
        onChange={handlePickerChange}
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled || readOnly}
      />
      <button
        type="button"
        className={styles.pickerButton}
        onClick={triggerPicker}
        tabIndex={-1}
        aria-label="Calendar picker"
        disabled={disabled || readOnly}
      >
        📅
      </button>
    </div>
  )
}
