// @ts-check
/**
 * Form definition shapes (stored in form_versions.definition JSONB).
 * Pure documentation module — no runtime code.
 *
 * @typedef {Object.<string, string>} LocalizedText
 *   Map of locale → text, e.g. {"en": "Full name", "es": "Nombre completo"}.
 *
 * @typedef {'text'|'textarea'|'select'|'multiselect'|'radio'|'checkbox'|
 *           'date'|'number'|'email'|'phone'|'file'|'section'} QuestionType
 *
 * @typedef {'eq'|'neq'|'in'|'notIn'|'gt'|'gte'|'lt'|'lte'|
 *           'isEmpty'|'isNotEmpty'|'contains'} RuleOperator
 *
 * @typedef {Object} Rule
 * @property {string} questionId  Must reference a question EARLIER in the list.
 * @property {RuleOperator} operator
 * @property {*} [value]
 *
 * @typedef {Object} RuleGroup
 * @property {'and'|'or'} op
 * @property {Rule[]} rules
 *
 * @typedef {Object} QuestionOption
 * @property {string} value
 * @property {LocalizedText} label
 *
 * @typedef {Object} Validation
 * @property {number} [min]        number: minimum value
 * @property {number} [max]        number: maximum value
 * @property {number} [minLength]
 * @property {number} [maxLength]
 * @property {string} [pattern]    RegExp source applied to text answers
 * @property {string[]} [accept]   file: allowed extensions
 * @property {number} [maxFileMb]
 *
 * @typedef {Object} Question
 * @property {string} id           Stable, immutable once answers exist.
 * @property {QuestionType} type
 * @property {LocalizedText} label
 * @property {LocalizedText} [help]
 * @property {QuestionOption[]} [options]   select/multiselect/radio
 * @property {boolean} [required]
 * @property {Validation} [validation]
 * @property {string[]} [participantTypes]  Type keys that see this question;
 *                                          omitted/empty = all types.
 * @property {RuleGroup} [visibleIf]
 * @property {boolean} [archived]  Hidden from new forms, kept for old answers.
 *
 * @typedef {Object} FormDefinition
 * @property {Question[]} questions
 */

export {}
