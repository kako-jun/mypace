import type { KeyboardEvent } from 'react'

interface TextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  className?: string
  maxLength?: number
  required?: boolean
  autoFocus?: boolean
  rows?: number
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}

export default function Textarea({
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  className = '',
  maxLength,
  required = false,
  autoFocus = false,
  rows = 3,
  onKeyDown,
}: TextareaProps) {
  return (
    <textarea
      value={value}
      onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      className={`textarea ${className}`}
      maxLength={maxLength}
      required={required}
      autoFocus={autoFocus}
      rows={rows}
    />
  )
}
