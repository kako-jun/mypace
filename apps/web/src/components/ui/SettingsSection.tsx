import type { ReactNode, CSSProperties } from 'react'

interface Props {
  children: ReactNode
  title?: string
  variant?: 'default' | 'danger'
  className?: string
  style?: CSSProperties
}

export default function SettingsSection({ children, title, variant = 'default', className = '', style }: Props) {
  const variantClass = variant === 'danger' ? 'danger' : ''
  return (
    <div className={`settings-section ${variantClass} ${className}`.trim()} style={style}>
      {title && <h3>{title}</h3>}
      {children}
    </div>
  )
}
