import Icon from './Icon'

interface Props {
  copied: boolean
  onClick: () => void
  className?: string
  size?: number
  label?: string
  'aria-label'?: string
}

export default function CopyButton({
  copied,
  onClick,
  className = '',
  size = 14,
  label,
  'aria-label': ariaLabel,
}: Props) {
  return (
    <button className={className || undefined} onClick={onClick} aria-label={ariaLabel || (copied ? 'Copied' : 'Copy')}>
      {copied ? <Icon name="Check" size={size} /> : <Icon name="Copy" size={size} />}
      {label && <span>{copied ? 'Copied!' : label}</span>}
    </button>
  )
}
