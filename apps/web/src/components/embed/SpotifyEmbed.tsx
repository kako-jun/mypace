import { useState } from 'react'
import { Icon } from '../ui'
import { getSpotifyEmbedUrl } from '../../lib/utils/embed'

interface SpotifyEmbedProps {
  spotifyId: string
  spotifyType: 'track' | 'album' | 'playlist' | 'episode' | 'show'
  url: string
}

export default function SpotifyEmbed({ spotifyId, spotifyType, url }: SpotifyEmbedProps) {
  const [loaded, setLoaded] = useState(false)

  const getTypeLabel = () => {
    switch (spotifyType) {
      case 'track':
        return 'track'
      case 'album':
        return 'album'
      case 'playlist':
        return 'playlist'
      case 'episode':
        return 'episode'
      case 'show':
        return 'podcast'
      default:
        return 'content'
    }
  }

  // Determine height based on content type
  const getHeight = () => {
    switch (spotifyType) {
      case 'track':
        return 152
      case 'episode':
        return 152
      case 'album':
        return 352
      case 'playlist':
        return 352
      case 'show':
        return 352
      default:
        return 152
    }
  }

  if (!loaded) {
    return (
      <div className="embed-container embed-spotify embed-placeholder" onClick={() => setLoaded(true)}>
        <div className="embed-placeholder-content">
          <Icon name="Music" size={32} />
          <span className="embed-placeholder-text">Click to load {getTypeLabel()}</span>
          <span className="embed-placeholder-domain">Spotify</span>
        </div>
      </div>
    )
  }

  return (
    <div className="embed-container embed-spotify" style={{ height: getHeight() }}>
      <iframe
        src={getSpotifyEmbedUrl(spotifyId, spotifyType)}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        style={{ borderRadius: '12px' }}
      />
      <a href={url} target="_blank" rel="noopener noreferrer" className="embed-external-link">
        <Icon name="ExternalLink" size={12} /> Spotify
      </a>
    </div>
  )
}
