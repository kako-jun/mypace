import { useNavigate } from 'react-router-dom'
import { getThemeCardProps } from '../lib/nostr/theme'
import { getThemeColors } from '../lib/storage'
import { BackButton } from '../components/ui'
import '../styles/pages/not-found.css'

export function NotFoundPage() {
  const navigate = useNavigate()
  const themeProps = getThemeCardProps(getThemeColors())
  const textClass = themeProps.className.includes('light-text') ? 'light-text' : 'dark-text'

  return (
    <div className="not-found-page">
      <BackButton onClick={() => navigate(-1)} />

      <div className={`not-found-header ${textClass}`}>
        <h2>404</h2>
        <p>Page not found.</p>
      </div>
    </div>
  )
}
