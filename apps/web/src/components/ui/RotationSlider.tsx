import { ChevronLeft, ChevronRight } from 'lucide-react'
import '../../styles/components/rotation-slider.css'

interface RotationSliderProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

export function RotationSlider({ value, onChange, min = -90, max = 90 }: RotationSliderProps) {
  const step = (delta: number) => onChange(Math.max(min, Math.min(max, value + delta)))

  return (
    <div className="rotation-slider-row">
      <span className="rotation-slider-label">{min}°</span>
      <button type="button" className="rotation-step-btn" onClick={() => step(-1)} aria-label="-1°">
        <ChevronLeft size={14} />
      </button>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rotation-slider"
      />
      <button type="button" className="rotation-step-btn" onClick={() => step(1)} aria-label="+1°">
        <ChevronRight size={14} />
      </button>
      <span className="rotation-slider-label">+{max}°</span>
      <span className="rotation-slider-value">{value}°</span>
    </div>
  )
}
