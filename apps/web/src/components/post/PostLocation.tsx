import geohash from 'ngeohash'
import { Icon } from '../ui'

interface PostLocationProps {
  geohashStr: string
  name?: string
}

function getStaticMapUrl(hash: string): string {
  try {
    const { latitude, longitude } = geohash.decode(hash)
    const zoom = 15
    const n = Math.pow(2, zoom)
    const x = Math.floor(((longitude + 180) / 360) * n)
    const y = Math.floor(
      ((1 - Math.log(Math.tan((latitude * Math.PI) / 180) + 1 / Math.cos((latitude * Math.PI) / 180)) / Math.PI) / 2) *
        n
    )
    return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
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
