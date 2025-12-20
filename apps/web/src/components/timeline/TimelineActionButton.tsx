interface TimelineActionButtonProps {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}

export function TimelineActionButton({ onClick, disabled = false, children }: TimelineActionButtonProps) {
  return (
    <button type="button" className="timeline-action-button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}
