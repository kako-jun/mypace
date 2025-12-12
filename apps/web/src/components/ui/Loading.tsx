import { getStoredThemeColors, isDarkColor } from '../../lib/nostr/theme'
import './Loading.css'

function useLoadingColorClass(): string {
  const colors = getStoredThemeColors()
  if (!colors) return ''

  const darkCount =
    (isDarkColor(colors.topLeft) ? 1 : 0) +
    (isDarkColor(colors.topRight) ? 1 : 0) +
    (isDarkColor(colors.bottomLeft) ? 1 : 0) +
    (isDarkColor(colors.bottomRight) ? 1 : 0)

  return darkCount >= 2 ? 'loading-light' : 'loading-dark'
}

export default function Loading() {
  const colorClass = useLoadingColorClass()

  return (
    <div className="loading-overlay">
      <div className={`loading-circle ${colorClass}`}>
        <img src="/static/star.webp" alt="" className="loading-star" />
        <span className="loading-text">Loading...</span>
      </div>
    </div>
  )
}
