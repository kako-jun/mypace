import type { ReactNode } from 'react'
import { Icon } from '../ui'

interface EmbedPlaceholderProps {
  embedType: string
  iconName?: string
  icon?: ReactNode
  text: string
  domain?: string
  onClick: () => void
}

export default function EmbedPlaceholder({ embedType, iconName, icon, text, domain, onClick }: EmbedPlaceholderProps) {
  return (
    <div className={`embed-container embed-${embedType} embed-placeholder`} onClick={onClick}>
      <div className="embed-placeholder-content">
        {icon || (iconName && <Icon name={iconName} size={32} />)}
        <span className="embed-placeholder-text">{text}</span>
        {domain && <span className="embed-placeholder-domain">{domain}</span>}
      </div>
    </div>
  )
}
