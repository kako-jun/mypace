import { useState } from 'react'
import { Tweet } from 'react-tweet'
import { Icon } from '../ui'
import { API_BASE } from '../../lib/api'

interface TwitterEmbedProps {
  tweetId: string
  url: string
}

export default function TwitterEmbed({ tweetId, url }: TwitterEmbedProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  if (!loaded) {
    return (
      <div className="embed-container embed-twitter embed-placeholder" onClick={() => setLoaded(true)}>
        <div className="embed-placeholder-content">
          <Icon name="Twitter" size={32} />
          <span className="embed-placeholder-text">Click to load tweet</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="embed-container embed-twitter embed-error">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Icon name="Twitter" size={16} /> View tweet on X
        </a>
      </div>
    )
  }

  return (
    <div className="embed-container embed-twitter">
      <Tweet id={tweetId} apiUrl={`${API_BASE}/api/tweet/${tweetId}`} onError={() => setError(true)} />
    </div>
  )
}
