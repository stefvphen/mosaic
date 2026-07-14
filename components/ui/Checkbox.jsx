'use client'

import * as RadixCheckbox from '@radix-ui/react-checkbox'

const boxStyle = {
  width: 20,
  height: 20,
  flexShrink: 0,
  borderRadius: 5,
  border: '1.5px solid var(--line-strong)',
  background: 'var(--surface)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  marginTop: 2,
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2 6.5L4.5 9L10 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function Checkbox({ checked, onCheckedChange, id, ...props }) {
  return (
    <RadixCheckbox.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      style={{
        ...boxStyle,
        background: checked ? 'var(--pine)' : 'var(--surface)',
        borderColor: checked ? 'var(--pine)' : 'var(--line-strong)',
        color: '#fff',
        cursor: 'pointer',
        padding: 0,
      }}
      {...props}
    >
      <RadixCheckbox.Indicator>
        <CheckIcon />
      </RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  )
}

/** A checkbox with its label in a bordered, clickable row. */
export function CheckboxRow({ checked, onCheckedChange, label, id }) {
  return (
    <label className="choice-row" data-checked={checked || undefined} htmlFor={id}>
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <span>{label}</span>
    </label>
  )
}
