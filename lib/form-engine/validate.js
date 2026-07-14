// @ts-check
/**
 * Answer validation for one participant. Dependency-free so the identical
 * module runs in the browser (live errors) and in the submit Edge Function
 * (authoritative server-side check). Never let these two diverge.
 */

import { visibleQuestions } from './visibility.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Lenient international phone: digits, spaces, dashes, parens, leading +
const PHONE_RE = /^\+?[0-9()\-\s.]{5,25}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isEmptyAnswer(v) {
  return (
    v == null || v === '' || v === false || (Array.isArray(v) && v.length === 0)
  )
}

/**
 * Validate a single answer against its question. Returns an error code
 * (i18n key suffix) or null. Codes: required, invalid, tooShort, tooLong,
 * tooSmall, tooBig, notAnOption.
 *
 * @param {import('./schema').Question} q
 * @param {*} value
 * @returns {string|null}
 */
export function validateAnswer(q, value) {
  const v = q.validation ?? {}

  if (isEmptyAnswer(value)) {
    return q.required ? 'required' : null
  }

  switch (q.type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string') return 'invalid'
      if (v.minLength != null && value.length < v.minLength) return 'tooShort'
      if (v.maxLength != null && value.length > v.maxLength) return 'tooLong'
      if (v.pattern) {
        try {
          if (!new RegExp(v.pattern).test(value)) return 'invalid'
        } catch {
          // invalid pattern in definition — don't block the registrant
        }
      }
      return null
    }
    case 'email':
      return typeof value === 'string' && EMAIL_RE.test(value) ? null : 'invalid'
    case 'phone':
      return typeof value === 'string' && PHONE_RE.test(value) ? null : 'invalid'
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value)
      if (typeof value === 'boolean' || String(value).trim() === '' || Number.isNaN(n)) {
        return 'invalid'
      }
      if (v.min != null && n < v.min) return 'tooSmall'
      if (v.max != null && n > v.max) return 'tooBig'
      return null
    }
    case 'date':
      if (typeof value !== 'string' || !DATE_RE.test(value)) return 'invalid'
      return Number.isNaN(Date.parse(value)) ? 'invalid' : null
    case 'select':
    case 'radio': {
      const allowed = (q.options ?? []).map((o) => o.value)
      return allowed.includes(value) ? null : 'notAnOption'
    }
    case 'multiselect': {
      if (!Array.isArray(value)) return 'invalid'
      const allowed = (q.options ?? []).map((o) => o.value)
      return value.every((x) => allowed.includes(x)) ? null : 'notAnOption'
    }
    case 'checkbox':
      return typeof value === 'boolean' ? null : 'invalid'
    case 'file':
      // Value is a storage object path; ownership is verified server-side.
      return typeof value === 'string' && value.length > 0 ? null : 'invalid'
    case 'section':
      return null
    default:
      return 'invalid'
  }
}

/**
 * Validate a whole participant's answers against a form definition.
 *
 * - Only questions visible for this type + answer state are validated.
 * - Answers for hidden/inapplicable/unknown questions are PRUNED from the
 *   cleaned result (the classic conditional-forms bug, decided here once).
 * - `section` pseudo-questions never carry answers.
 *
 * @param {import('./schema').FormDefinition} definition
 * @param {string} participantTypeKey
 * @param {Object.<string, *>} answers
 * @returns {{valid: boolean, errors: Object.<string,string>, cleaned: Object.<string,*>}}
 */
export function validateParticipantAnswers(definition, participantTypeKey, answers = {}) {
  const visible = visibleQuestions(definition, participantTypeKey, answers)
  /** @type {Object.<string,string>} */
  const errors = {}
  /** @type {Object.<string,*>} */
  const cleaned = {}

  for (const q of visible) {
    if (q.type === 'section') continue
    const value = answers[q.id]
    const err = validateAnswer(q, value)
    if (err) {
      errors[q.id] = err
    } else if (!isEmptyAnswer(value)) {
      cleaned[q.id] = q.type === 'number' ? Number(value) : value
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, cleaned }
}
