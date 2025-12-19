import type { ReactNode } from 'react'

interface Props {
  children?: ReactNode
  className?: string
}

export default function SuccessMessage({ children, className = '' }: Props) {
  if (!children) return null

  return <p className={`success ${className}`.trim()}>{children}</p>
}
