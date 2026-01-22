import { getThemeCardProps } from '../lib/nostr/theme'
import { getThemeColors } from '../lib/storage'
import '../styles/pages/not-found.css'

export function NotFoundPage() {
  const themeProps = getThemeCardProps(getThemeColors())
  const textClass = themeProps.className.includes('light-text') ? 'light-text' : 'dark-text'

  return (
    <div className="not-found-page">
      <div className={`not-found-header ${textClass}`}>
        <h1>404</h1>
      </div>
    </div>
  )
}
