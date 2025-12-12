import { useState } from 'react'
import { Icon } from '../ui'
import { getYouTubeThumbnail, getYouTubeShortsEmbedUrl } from '../../lib/utils/embed'

interface YouTubeShortsEmbedProps {
  videoId: string
}

export default function YouTubeShortsEmbed({ videoId }: YouTubeShortsEmbedProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const handleError = () => {
    setError(true)
  }

  if (error) {
    return (
      <div className="embed-container embed-youtube-shorts embed-error">
        <a
          href={`https://youtube.com/shorts/${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="embed-error-link"
        >
          <Icon name="Youtube" size={24} />
          <span>Watch on YouTube</span>
        </a>
      </div>
    )
  }

  if (loaded) {
    return (
      <div className="embed-container embed-youtube-shorts">
        <iframe
          src={getYouTubeShortsEmbedUrl(videoId)}
          title="YouTube Shorts video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
          onError={handleError}
        />
      </div>
    )
  }

  return (
    <div className="embed-container embed-youtube-shorts embed-thumbnail" onClick={() => setLoaded(true)}>
      <img src={getYouTubeThumbnail(videoId)} alt="YouTube Shorts thumbnail" loading="lazy" onError={handleError} />
      <div className="embed-play-overlay">
        <div className="embed-play-button embed-shorts-button">
          <Icon name="Play" size={24} />
        </div>
        <span className="embed-shorts-badge">Shorts</span>
      </div>
    </div>
  )
}
