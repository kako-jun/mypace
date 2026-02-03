import '../../styles/components/rotation-slider.css'

interface RotationSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function RotationSlider({ value, onChange, min = -90, max = 90 }: RotationSliderProps) {
  return (
    <div className="rotation-slider-row">
      <span className="rotation-slider-label">{min}°</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rotation-slider"
      />
      <span className="rotation-slider-label">+{max}°</span>
      <span className="rotation-slider-value">{value}°</span>
    </div>
  )
}
