import type { RefObject } from 'hono/jsx'

interface TextAreaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  readOnly?: boolean
  className?: string
  rows?: number
  maxLength?: number
  autoFocus?: boolean
  ref?: RefObject<HTMLTextAreaElement>
}

export default function TextArea({
  value,
  onChange,
  placeholder,
  disabled = false,
  readOnly = false,
  className = '',
  rows = 3,
  maxLength,
  autoFocus = false,
  ref,
}: TextAreaProps) {
  return (
    <textarea
      value={value}
      onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      placeholder={placeholder}
      disabled={disabled}
      readOnly={readOnly}
      class={`textarea ${className}`}
      rows={rows}
      maxLength={maxLength}
      autoFocus={autoFocus}
      ref={ref}
    />
  )
}
