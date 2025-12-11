import { useState } from 'react'
import { getYouTubeThumbnail, getYouTubeEmbedUrl } from '../../lib/utils/embed'
import { Icon } from '../ui'

interface YouTubeEmbedProps {
  videoId: string
}

export default function YouTubeEmbed({ videoId }: YouTubeEmbedProps) {
  const [loaded, setLoaded] = useState(false)

  if (loaded) {
    return (
      <div className="embed-container embed-youtube">
        <iframe
          src={getYouTubeEmbedUrl(videoId)}
          title="YouTube video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="embed-container embed-youtube embed-thumbnail" onClick={() => setLoaded(true)}>
      <img src={getYouTubeThumbnail(videoId)} alt="YouTube video thumbnail" loading="lazy" />
      <div className="embed-play-overlay">
        <div className="embed-play-button">
          <Icon name="Play" size={32} />
        </div>
      </div>
    </div>
  )
}
