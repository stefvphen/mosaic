'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { lt } from '@/lib/i18n/locales'
import styles from './builder.module.css'

export function SortableQuestionCard({
  question: q,
  locale,
  defaultLocale,
  typeLabel,
  selected,
  onSelect,
  onRemove,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: q.id })

  const label = lt(q.label, locale, defaultLocale)

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
      }}
      className={styles.questionCard}
      data-selected={selected || undefined}
      data-section={q.type === 'section' || undefined}
    >
      <button
        className={styles.dragHandle}
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <button className={styles.questionBody} onClick={onSelect}>
        <span className={styles.questionLabel}>
          {label || <em className={styles.unlabeled}>…</em>}
          {q.required && <span className={styles.req}> *</span>}
        </span>
        <span className={styles.questionMeta}>
          {typeLabel}
          {q.visibleIf?.rules?.length ? ' · ⑂' : ''}
          {q.participantTypes?.length ? ` · ${q.participantTypes.join(', ')}` : ''}
        </span>
      </button>
      <button className={styles.removeBtn} aria-label="Delete" onClick={onRemove}>
        ×
      </button>
    </li>
  )
}
