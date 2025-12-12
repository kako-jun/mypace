import { useState } from 'react'
import { Icon } from '../ui'
import { getYouTubeThumbnail, getYouTubeShortsEmbedUrl } from '../../lib/utils/embed'

interface YouTubeShortsEmbedProps {
  videoId: string
}

export default function YouTubeShortsEmbed({ videoId }: YouTubeShortsEmbedProps) {
  const [loaded, setLoaded] = useState(false)

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
        />
      </div>
    )
  }

  return (
    <div className="embed-container embed-youtube-shorts embed-thumbnail" onClick={() => setLoaded(true)}>
      <img src={getYouTubeThumbnail(videoId)} alt="YouTube Shorts thumbnail" loading="lazy" />
      <div className="embed-play-overlay">
        <div className="embed-play-button embed-shorts-button">
          <Icon name="Play" size={24} />
        </div>
        <span className="embed-shorts-badge">Shorts</span>
      </div>
    </div>
  )
}
