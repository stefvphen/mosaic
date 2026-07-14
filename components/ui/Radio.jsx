'use client'

import * as RadixRadio from '@radix-ui/react-radio-group'

export function RadioGroup({ value, onValueChange, children, ...props }) {
  return (
    <RadixRadio.Root
      className="choice-group"
      value={value ?? ''}
      onValueChange={onValueChange}
      {...props}
    >
      {children}
    </RadixRadio.Root>
  )
}

export function RadioRow({ value, label, checked, id }) {
  return (
    <label className="choice-row" data-checked={checked || undefined} htmlFor={id}>
      <RadixRadio.Item
        id={id}
        value={value}
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          borderRadius: '50%',
          border: checked
            ? '6px solid var(--pine)'
            : '1.5px solid var(--line-strong)',
          background: 'var(--surface)',
          cursor: 'pointer',
          padding: 0,
          marginTop: 2,
        }}
      />
      <span>{label}</span>
    </label>
  )
}
