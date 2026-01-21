import { getThemeCardProps } from '../../lib/nostr/theme'
import './Loading.css'

export default function Loading() {
  const themeProps = getThemeCardProps(null)
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
