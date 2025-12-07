interface ColorPickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
}

export default function ColorPicker({
  value,
  onChange,
  label,
  disabled = false,
}: ColorPickerProps) {
  return (
    <label class="color-picker">
      <input
        type="color"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        disabled={disabled}
      />
      {label && <span class="color-picker-label">{label}</span>}
    </label>
  )
}
