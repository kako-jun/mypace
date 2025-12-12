import { useState } from 'react'
import { Icon } from '../ui'

interface InstagramEmbedProps {
  instagramId: string
  instagramType: 'post' | 'reel' | 'stories'
  url: string
}

export default function InstagramEmbed({ instagramId, instagramType, url }: InstagramEmbedProps) {
  const [loaded, setLoaded] = useState(false)

  // Stories cannot be embedded - show link only
  if (instagramType === 'stories') {
    return (
      <div className="embed-container embed-instagram embed-simple-link">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Icon name="Instagram" size={16} />
          <span>View story on Instagram</span>
        </a>
      </div>
    )
  }

  const embedUrl =
    instagramType === 'reel'
      ? `https://www.instagram.com/reel/${instagramId}/embed`
      : `https://www.instagram.com/p/${instagramId}/embed`

  if (!loaded) {
    return (
      <div className="embed-container embed-instagram embed-placeholder" onClick={() => setLoaded(true)}>
        <div className="embed-placeholder-content">
          <Icon name="Instagram" size={32} />
          <span className="embed-placeholder-text">Click to load {instagramType === 'reel' ? 'reel' : 'post'}</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`embed-container embed-instagram ${instagramType === 'reel' ? 'embed-vertical' : ''}`}>
      <iframe src={embedUrl} frameBorder="0" scrolling="no" allowTransparency allow="encrypted-media" loading="lazy" />
      <a href={url} target="_blank" rel="noopener noreferrer" className="embed-external-link">
        <Icon name="ExternalLink" size={12} /> Instagram
      </a>
    </div>
  )
}
