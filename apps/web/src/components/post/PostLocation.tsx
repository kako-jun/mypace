import geohash from 'ngeohash'
import { Icon } from '../ui'

interface PostLocationProps {
  geohashStr: string
  name?: string
}

interface TileData {
  url: string
  offsetX: number // percentage offset within tile (0-100)
  offsetY: number
}

function getTileData(hash: string): TileData | null {
  try {
    const { latitude, longitude } = geohash.decode(hash)
    const zoom = 16 // Higher zoom for better precision
    const n = Math.pow(2, zoom)

    // Calculate tile coordinates
    const xFloat = ((longitude + 180) / 360) * n
    const yFloat =
      ((1 - Math.log(Math.tan((latitude * Math.PI) / 180) + 1 / Math.cos((latitude * Math.PI) / 180)) / Math.PI) / 2) *
      n

    const x = Math.floor(xFloat)
    const y = Math.floor(yFloat)

    // Calculate offset within tile (0-100%)
    const offsetX = (xFloat - x) * 100
    const offsetY = (yFloat - y) * 100

    return {
      url: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
      offsetX,
      offsetY,
    }
  } catch {
    return null
  }
}

export function PostLocation({ geohashStr, name }: PostLocationProps) {
  const tileData = getTileData(geohashStr)

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
      {tileData && (
        <div className="post-location-map-container">
          <img
            src={tileData.url}
            alt=""
            className="post-location-map"
            style={{
              transform: `translate(${50 - tileData.offsetX}%, ${50 - tileData.offsetY}%)`,
            }}
          />
          <div className="post-location-marker">
            <Icon name="MapPin" size={24} />
          </div>
        </div>
      )}
      <div className="post-location-info">
        <Icon name="MapPin" size={14} />
        <span>{name || geohashStr}</span>
      </div>
    </button>
  )
}
