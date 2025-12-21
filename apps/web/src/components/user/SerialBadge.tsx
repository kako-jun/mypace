interface SerialBadgeProps {
  serial: number
  className?: string
}

export function SerialBadge({ serial, className = '' }: SerialBadgeProps) {
  return <span className={`serial-badge ${className}`}>Thanks #{serial}</span>
}

export default SerialBadge
