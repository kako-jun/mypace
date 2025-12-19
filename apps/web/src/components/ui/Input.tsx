import type { KeyboardEvent } from 'react'

interface InputProps {
  type?: 'text' | 'password' | 'email' | 'url'
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  className?: string
  maxLength?: number
  required?: boolean
  autoFocus?: boolean
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void
}

export default function Input({
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  className = '',
  maxLength,
  required = false,
  autoFocus = false,
  onKeyDown,
}: InputProps) {
  return (
    <input
      type={type}
      value={value}
      onInput={(e) => onChange((e.target as HTMLInputElement).value)}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      className={`input ${className}`}
      maxLength={maxLength}
      required={required}
      autoFocus={autoFocus}
    />
  )
}
