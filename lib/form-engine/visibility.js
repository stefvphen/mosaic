// @ts-check
/** Which questions a given participant sees, given their type and answers. */

import { evaluateVisibleIf } from './conditions.js'

/**
 * @param {import('./schema').Question} q
 * @param {string} participantTypeKey
 */
export function appliesToType(q, participantTypeKey) {
  if (q.archived) return false
  if (!Array.isArray(q.participantTypes) || q.participantTypes.length === 0) {
    return true
  }
  return q.participantTypes.includes(participantTypeKey)
}

/**
 * Questions visible to one participant right now: filtered by participant
 * type, then by conditional logic evaluated against their current answers.
 *
 * @param {import('./schema').FormDefinition} definition
 * @param {string} participantTypeKey
 * @param {Object.<string, *>} answers
 * @returns {import('./schema').Question[]}
 */
export function visibleQuestions(definition, participantTypeKey, answers = {}) {
  const typed = (definition?.questions ?? []).filter((q) =>
    appliesToType(q, participantTypeKey)
  )
  return typed.filter((q) => evaluateVisibleIf(answers, q.visibleIf))
}
