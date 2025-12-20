import { Icon } from './Icon'

interface CloseButtonProps {
  onClick: () => void
  size?: number
  className?: string
}

export function CloseButton({ onClick, size = 20, className = '' }: CloseButtonProps) {
  return (
    <button type="button" className={`close-button ${className}`.trim()} onClick={onClick} aria-label="Close">
      <Icon name="X" size={size} />
    </button>
  )
}
