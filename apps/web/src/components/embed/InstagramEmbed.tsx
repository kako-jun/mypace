import { useState } from 'react'
import { SiInstagram } from 'react-icons/si'
import { Icon, ExternalLink } from '../ui'
import EmbedPlaceholder from './EmbedPlaceholder'

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
        <ExternalLink href={url}>
          <SiInstagram size={16} />
          <span>View story on Instagram</span>
        </ExternalLink>
      </div>
    )
  }

  const embedUrl =
    instagramType === 'reel'
      ? `https://www.instagram.com/reel/${instagramId}/embed`
      : `https://www.instagram.com/p/${instagramId}/embed`

  if (!loaded) {
    return (
      <EmbedPlaceholder
        embedType="instagram"
        icon={<SiInstagram size={32} />}
        text={`Click to load ${instagramType === 'reel' ? 'reel' : 'post'}`}
        onClick={() => setLoaded(true)}
      />
    )
  }

  return (
    <div className={`embed-container embed-instagram ${instagramType === 'reel' ? 'embed-vertical' : ''}`}>
      <iframe src={embedUrl} frameBorder="0" scrolling="no" allowTransparency allow="encrypted-media" loading="lazy" />
      <ExternalLink href={url} className="embed-external-link">
        <Icon name="ExternalLink" size={12} /> Instagram
      </ExternalLink>
    </div>
  )
}
