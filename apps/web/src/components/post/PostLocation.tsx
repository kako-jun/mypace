import geohash from 'ngeohash'
import { Icon } from '../ui'

interface PostLocationProps {
  geohashStr: string
  name?: string
}

function getStaticMapUrl(hash: string): string {
  try {
    const { latitude, longitude } = geohash.decode(hash)
    // Use OpenStreetMap Static Map API - centers on coordinates with marker
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=200x130&maptype=mapnik&markers=${latitude},${longitude},red-pushpin`
  } catch {
    return ''
  }
}

export function PostLocation({ geohashStr, name }: PostLocationProps) {
  const mapUrl = getStaticMapUrl(geohashStr)

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
      {mapUrl && <img src={mapUrl} alt="" className="post-location-map" />}
      <div className="post-location-info">
        <Icon name="MapPin" size={14} />
        <span>{name || geohashStr}</span>
      </div>
    </button>
  )
}
