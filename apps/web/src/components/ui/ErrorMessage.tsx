import type { ReactNode } from 'react'

interface Props {
  children?: ReactNode
  variant?: 'inline' | 'box'
  className?: string
}

export default function ErrorMessage({ children, variant = 'inline', className = '' }: Props) {
  if (!children) return null

  if (variant === 'box') {
    return <div className={`error-box ${className}`.trim()}>{children}</div>
  }

  return <p className={`error ${className}`.trim()}>{children}</p>
}
