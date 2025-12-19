import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  variant?: 'default' | 'primary' | 'warning'
  className?: string
  'aria-label'?: string
  title?: string
}

export default function TextButton({
  children,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'default',
  className = '',
  'aria-label': ariaLabel,
  title,
}: Props) {
  const variantClass = variant !== 'default' ? `text-outlined-${variant}` : ''
  return (
    <button
      type={type}
      className={`text-outlined text-outlined-button ${variantClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  )
}
