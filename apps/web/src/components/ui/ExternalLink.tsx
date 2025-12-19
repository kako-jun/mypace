import type { ReactNode } from 'react'

interface Props {
  href: string
  children: ReactNode
  className?: string
  title?: string
}

export default function ExternalLink({ href, children, className = '', title }: Props) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className || undefined} title={title}>
      {children}
    </a>
  )
}
