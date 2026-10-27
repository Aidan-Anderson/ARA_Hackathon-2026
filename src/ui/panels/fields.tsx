// Form inputs shared by the Loads and Code calc tabs. Styles: .form-grid in ResultsPanel.css.

import { useState } from 'react'

/**
 * A number input that lets the user type freely ("0.", "-") and commits each valid number.
 * While focused it shows the typed text; otherwise it shows the project's value.
 */
export function NumberField({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number | undefined
  onCommit: (value: number | undefined) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label>
      <span>{label}</span>
      <input
        inputMode="decimal"
        value={draft ?? (value === undefined ? '' : String(value))}
        onChange={(event) => {
          const text = event.target.value
          setDraft(text)
          if (text.trim() === '') onCommit(undefined)
          else if (Number.isFinite(Number(text))) onCommit(Number(text))
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  )
}

/**
 * A text input committed on Enter or blur. If `onCommit` returns false the text is rejected
 * and the field shows it as invalid until the user fixes it or leaves.
 */
export function TextField({
  label,
  value,
  onCommit,
  wide = false,
}: {
  label: string
  value: string
  onCommit: (value: string) => boolean
  wide?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  const commit = () => {
    if (draft === null) return
    if (onCommit(draft)) {
      setDraft(null)
      setInvalid(false)
    } else setInvalid(true)
  }
  return (
    <label className={wide ? 'wide' : undefined}>
      <span>{label}</span>
      <input
        className={invalid ? 'invalid' : undefined}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
        onBlur={() => {
          commit()
          setDraft(null)
          setInvalid(false)
        }}
      />
    </label>
  )
}

export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: readonly string[]
  onChange: (value: string) => void
}) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option === '' ? '—' : option}
          </option>
        ))}
      </select>
    </label>
  )
}
