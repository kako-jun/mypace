import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  variant?: 'primary' | 'danger' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  title?: string
}

export default function Button({
  children,
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  size = 'lg',
  className = '',
  title,
}: Props) {
  const sizeClass = size !== 'lg' ? `btn-${size}` : 'btn-lg'
  return (
    <button
      type={type}
      className={`btn btn-${variant} ${sizeClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  )
}
