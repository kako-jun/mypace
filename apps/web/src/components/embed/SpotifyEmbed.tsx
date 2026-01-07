import { useState } from 'react'
import { SiSpotify } from 'react-icons/si'
import { Icon, ExternalLink } from '../ui'
import { getSpotifyEmbedUrl } from '../../lib/utils/embed'
import EmbedPlaceholder from './EmbedPlaceholder'

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
      <EmbedPlaceholder
        embedType="spotify"
        icon={<SiSpotify size={32} />}
        text={`Click to load ${getTypeLabel()}`}
        onClick={() => setLoaded(true)}
      />
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
      <ExternalLink href={url} className="embed-external-link">
        <Icon name="ExternalLink" size={12} /> Spotify
      </ExternalLink>
    </div>
  )
}
