interface Props {
  onClick: () => void
  label?: string
  icon?: '←' | '×'
  className?: string
}

export default function BackButton({ onClick, label = 'BACK', icon = '←', className = '' }: Props) {
  return (
    <button className={`back-button text-outlined text-outlined-button ${className}`.trim()} onClick={onClick}>
      <span className="back-button-icon">{icon}</span>
      <span className="back-button-label">{label}</span>
    </button>
  )
}
