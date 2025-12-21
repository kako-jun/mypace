import geohash from 'ngeohash'
import { Icon } from '../ui'

interface PostLocationProps {
  geohashStr: string
  name?: string
}

export function PostLocation({ geohashStr, name }: PostLocationProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const { latitude, longitude } = geohash.decode(geohashStr)
      window.open(
        `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=17`,
        '_blank',
        'noopener,noreferrer'
      )
    } catch {
      // Invalid geohash, do nothing
    }
  }

  return (
    <button type="button" className="post-location" onClick={handleClick} title="View on map">
      <Icon name="MapPin" size={14} />
      <span>{name || geohashStr}</span>
    </button>
  )
}
