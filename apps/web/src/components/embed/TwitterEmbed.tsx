import { useState, useEffect } from 'react'
import { Tweet } from 'react-tweet'
import { Icon, ExternalLink } from '../ui'
import { API_BASE } from '../../lib/api'

interface TwitterEmbedProps {
  tweetId: string
  url: string
}

interface TweetData {
  text?: string
  user?: {
    name?: string
    screen_name?: string
    profile_image_url_https?: string
  }
  created_at?: string
}

export default function TwitterEmbed({ tweetId, url }: TwitterEmbedProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const [tweetData, setTweetData] = useState<TweetData | null>(null)

  // Prefetch tweet data for fallback display
  useEffect(() => {
    if (loaded && !error) {
      fetch(`${API_BASE}/api/tweet/${tweetId}`)
        .then((res) => res.json())
        .then((data) => setTweetData(data))
        .catch(() => {})
    }
  }, [loaded, error, tweetId])

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
    // Show tweet content if available, otherwise just link
    return (
      <div className="embed-container embed-twitter embed-fallback">
        {tweetData?.text ? (
          <ExternalLink href={url} className="embed-twitter-fallback-content">
            {tweetData.user?.profile_image_url_https && (
              <img src={tweetData.user.profile_image_url_https} alt="" className="embed-twitter-avatar" />
            )}
            <div className="embed-twitter-body">
              <div className="embed-twitter-header">
                <span className="embed-twitter-name">{tweetData.user?.name}</span>
                <span className="embed-twitter-handle">@{tweetData.user?.screen_name}</span>
              </div>
              <p className="embed-twitter-text">{tweetData.text}</p>
              <div className="embed-twitter-footer">
                <Icon name="Twitter" size={14} />
                <span>View on X</span>
              </div>
            </div>
          </ExternalLink>
        ) : (
          <ExternalLink href={url} className="embed-twitter-link">
            <Icon name="Twitter" size={16} /> View tweet on X
          </ExternalLink>
        )}
      </div>
    )
  }

  return (
    <div className="embed-container embed-twitter">
      <Tweet id={tweetId} apiUrl={`${API_BASE}/api/tweet/${tweetId}`} onError={() => setError(true)} />
    </div>
  )
}
