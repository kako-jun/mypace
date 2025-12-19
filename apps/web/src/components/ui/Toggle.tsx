interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  disabled?: boolean
  size?: 'small' | 'normal'
}

export default function Toggle({ checked, onChange, label, disabled = false, size = 'normal' }: ToggleProps) {
  return (
    <label className={`toggle ${size === 'small' ? 'toggle-small' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        disabled={disabled}
      />
      <span className="toggle-slider" />
      {label && <span className="toggle-label">{label}</span>}
    </label>
  )
}
