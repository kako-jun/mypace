import Button from '../ui/Button'

interface TimelineActionButtonProps {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
}

const noop = () => {}

export function TimelineActionButton({ onClick = noop, disabled = false, children }: TimelineActionButtonProps) {
  return (
    <div className="timeline-action-wrapper">
      <Button onClick={onClick} disabled={disabled} variant="primary" size="lg">
        {children}
      </Button>
    </div>
  )
}
