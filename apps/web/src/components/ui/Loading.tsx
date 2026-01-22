import { getThemeCardProps } from '../../lib/nostr/theme'
import { getThemeColors } from '../../lib/storage'
import './Loading.css'

export default function Loading() {
  const themeProps = getThemeCardProps(getThemeColors())
  const colorClass = themeProps.className.includes('light-text') ? 'loading-light' : 'loading-dark'

  return (
    <div className="loading-overlay">
      <div className={`loading-circle ${colorClass}`}>
        <img src="/static/star.webp" alt="" className="loading-star" />
        <span className="loading-text">Loading...</span>
      </div>
    </div>
  )
}
