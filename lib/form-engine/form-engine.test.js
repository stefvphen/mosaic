import { describe, it, expect } from 'vitest'
import { evaluateRule, evaluateVisibleIf } from './conditions.js'
import { visibleQuestions } from './visibility.js'
import { validateAnswer, validateParticipantAnswers } from './validate.js'

const definition = {
  questions: [
    { id: 'q_sec', type: 'section', label: { en: 'About' } },
    {
      id: 'q_role',
      type: 'select',
      required: true,
      label: { en: 'Role' },
      options: [
        { value: 'staff', label: { en: 'Staff' } },
        { value: 'other', label: { en: 'Other' } },
      ],
      participantTypes: ['adult'],
    },
    {
      id: 'q_role_other',
      type: 'text',
      required: true,
      label: { en: 'Which role?' },
      participantTypes: ['adult'],
      visibleIf: {
        op: 'and',
        rules: [{ questionId: 'q_role', operator: 'eq', value: 'other' }],
      },
    },
    {
      id: 'q_age',
      type: 'number',
      required: true,
      label: { en: 'Age' },
      validation: { min: 0, max: 17 },
      participantTypes: ['child'],
    },
    {
      id: 'q_diet',
      type: 'multiselect',
      label: { en: 'Diet' },
      options: [
        { value: 'vegan', label: { en: 'Vegan' } },
        { value: 'gf', label: { en: 'Gluten free' } },
      ],
    },
    {
      id: 'q_gf_detail',
      type: 'textarea',
      label: { en: 'GF details' },
      validation: { maxLength: 10 },
      visibleIf: {
        op: 'and',
        rules: [{ questionId: 'q_diet', operator: 'contains', value: 'gf' }],
      },
    },
    { id: 'q_old', type: 'text', label: { en: 'Old question' }, archived: true },
  ],
}

describe('evaluateRule', () => {
  it('eq / neq compare as strings', () => {
    expect(evaluateRule('other', { questionId: 'x', operator: 'eq', value: 'other' })).toBe(true)
    expect(evaluateRule(5, { questionId: 'x', operator: 'eq', value: '5' })).toBe(true)
    expect(evaluateRule('a', { questionId: 'x', operator: 'neq', value: 'b' })).toBe(true)
  })

  it('eq on missing answer is false, neq on missing answer is true', () => {
    expect(evaluateRule(undefined, { questionId: 'x', operator: 'eq', value: 'a' })).toBe(false)
    expect(evaluateRule(undefined, { questionId: 'x', operator: 'neq', value: 'a' })).toBe(true)
  })

  it('in / notIn', () => {
    expect(evaluateRule('b', { questionId: 'x', operator: 'in', value: ['a', 'b'] })).toBe(true)
    expect(evaluateRule('c', { questionId: 'x', operator: 'notIn', value: ['a', 'b'] })).toBe(true)
  })

  it('contains works for multiselect arrays and strings', () => {
    expect(evaluateRule(['gf', 'vegan'], { questionId: 'x', operator: 'contains', value: 'gf' })).toBe(true)
    expect(evaluateRule([], { questionId: 'x', operator: 'contains', value: 'gf' })).toBe(false)
    expect(evaluateRule('gluten-free', { questionId: 'x', operator: 'contains', value: 'free' })).toBe(true)
  })

  it('numeric comparisons coerce numeric strings and reject blanks', () => {
    expect(evaluateRule('18', { questionId: 'x', operator: 'gte', value: 18 })).toBe(true)
    expect(evaluateRule(17, { questionId: 'x', operator: 'gte', value: 18 })).toBe(false)
    expect(evaluateRule('', { questionId: 'x', operator: 'gte', value: 18 })).toBe(false)
    expect(evaluateRule(undefined, { questionId: 'x', operator: 'lt', value: 5 })).toBe(false)
  })

  it('isEmpty / isNotEmpty treat [], "", false, null as empty', () => {
    for (const empty of [[], '', false, null, undefined]) {
      expect(evaluateRule(empty, { questionId: 'x', operator: 'isEmpty' })).toBe(true)
    }
    expect(evaluateRule('x', { questionId: 'x', operator: 'isNotEmpty' })).toBe(true)
  })
})

describe('evaluateVisibleIf', () => {
  it('no group or empty rules → visible', () => {
    expect(evaluateVisibleIf({}, undefined)).toBe(true)
    expect(evaluateVisibleIf({}, { op: 'and', rules: [] })).toBe(true)
  })

  it('and requires all, or requires any', () => {
    const rules = [
      { questionId: 'a', operator: 'eq', value: '1' },
      { questionId: 'b', operator: 'eq', value: '2' },
    ]
    expect(evaluateVisibleIf({ a: '1', b: '2' }, { op: 'and', rules })).toBe(true)
    expect(evaluateVisibleIf({ a: '1', b: 'x' }, { op: 'and', rules })).toBe(false)
    expect(evaluateVisibleIf({ a: '1', b: 'x' }, { op: 'or', rules })).toBe(true)
  })
})

describe('visibleQuestions', () => {
  it('filters by participant type (empty participantTypes = everyone)', () => {
    const ids = visibleQuestions(definition, 'child', {}).map((q) => q.id)
    expect(ids).toContain('q_age')
    expect(ids).toContain('q_diet')
    expect(ids).not.toContain('q_role')
  })

  it('applies conditional logic against current answers', () => {
    let ids = visibleQuestions(definition, 'adult', { q_role: 'staff' }).map((q) => q.id)
    expect(ids).not.toContain('q_role_other')
    ids = visibleQuestions(definition, 'adult', { q_role: 'other' }).map((q) => q.id)
    expect(ids).toContain('q_role_other')
  })

  it('never shows archived questions', () => {
    const ids = visibleQuestions(definition, 'adult', {}).map((q) => q.id)
    expect(ids).not.toContain('q_old')
  })
})

describe('validateAnswer', () => {
  it('required vs optional empties', () => {
    expect(validateAnswer({ id: 'q', type: 'text', required: true }, '')).toBe('required')
    expect(validateAnswer({ id: 'q', type: 'text' }, '')).toBe(null)
    expect(validateAnswer({ id: 'q', type: 'multiselect', required: true, options: [] }, [])).toBe('required')
  })

  it('email / phone / date / number formats', () => {
    expect(validateAnswer({ id: 'q', type: 'email' }, 'a@b.co')).toBe(null)
    expect(validateAnswer({ id: 'q', type: 'email' }, 'nope')).toBe('invalid')
    expect(validateAnswer({ id: 'q', type: 'phone' }, '+1 (555) 010-2030')).toBe(null)
    expect(validateAnswer({ id: 'q', type: 'phone' }, 'call me')).toBe('invalid')
    expect(validateAnswer({ id: 'q', type: 'date' }, '2026-08-01')).toBe(null)
    expect(validateAnswer({ id: 'q', type: 'date' }, '2026-13-45')).toBe('invalid')
    expect(validateAnswer({ id: 'q', type: 'date' }, '01/02/2026')).toBe('invalid')
    expect(validateAnswer({ id: 'q', type: 'number', validation: { min: 0, max: 17 } }, '12')).toBe(null)
    expect(validateAnswer({ id: 'q', type: 'number', validation: { min: 0, max: 17 } }, 42)).toBe('tooBig')
    expect(validateAnswer({ id: 'q', type: 'number' }, 'abc')).toBe('invalid')
  })

  it('choice answers must be real options', () => {
    const q = { id: 'q', type: 'select', options: [{ value: 'a', label: {} }] }
    expect(validateAnswer(q, 'a')).toBe(null)
    expect(validateAnswer(q, 'zzz')).toBe('notAnOption')
    const m = { id: 'q', type: 'multiselect', options: [{ value: 'a', label: {} }] }
    expect(validateAnswer(m, ['a'])).toBe(null)
    expect(validateAnswer(m, ['a', 'zzz'])).toBe('notAnOption')
  })

  it('text length limits', () => {
    const q = { id: 'q', type: 'textarea', validation: { maxLength: 5 } }
    expect(validateAnswer(q, 'ok')).toBe(null)
    expect(validateAnswer(q, 'toooooo long')).toBe('tooLong')
  })
})

describe('validateParticipantAnswers', () => {
  it('valid adult submission is cleaned and passes', () => {
    const { valid, errors, cleaned } = validateParticipantAnswers(definition, 'adult', {
      q_role: 'staff',
      q_diet: ['vegan'],
    })
    expect(valid).toBe(true)
    expect(errors).toEqual({})
    expect(cleaned).toEqual({ q_role: 'staff', q_diet: ['vegan'] })
  })

  it('missing required visible question fails', () => {
    const { valid, errors } = validateParticipantAnswers(definition, 'adult', {})
    expect(valid).toBe(false)
    expect(errors.q_role).toBe('required')
  })

  it('required conditional question enforced only when visible', () => {
    let res = validateParticipantAnswers(definition, 'adult', { q_role: 'staff' })
    expect(res.valid).toBe(true)
    res = validateParticipantAnswers(definition, 'adult', { q_role: 'other' })
    expect(res.valid).toBe(false)
    expect(res.errors.q_role_other).toBe('required')
  })

  it('prunes answers to hidden questions (stale conditional answers)', () => {
    const { valid, cleaned } = validateParticipantAnswers(definition, 'adult', {
      q_role: 'staff',
      q_role_other: 'left over from before the user switched back',
    })
    expect(valid).toBe(true)
    expect(cleaned.q_role_other).toBeUndefined()
  })

  it('prunes answers to questions of other participant types and unknown ids', () => {
    const { cleaned } = validateParticipantAnswers(definition, 'child', {
      q_age: 9,
      q_role: 'staff',
      q_hacked: 'nope',
    })
    expect(cleaned).toEqual({ q_age: 9 })
  })

  it('number answers are normalized to numbers', () => {
    const { cleaned } = validateParticipantAnswers(definition, 'child', { q_age: '9' })
    expect(cleaned.q_age).toBe(9)
  })
})
