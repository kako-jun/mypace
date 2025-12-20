import Button from '../ui/Button'

interface TimelineActionButtonProps {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

export function TimelineActionButton({ onClick, disabled = false, children }: TimelineActionButtonProps) {
  return (
    <div className="timeline-action-wrapper">
      <Button onClick={onClick} disabled={disabled} variant="primary" size="lg">
        {children}
      </Button>
    </div>
  )
}
