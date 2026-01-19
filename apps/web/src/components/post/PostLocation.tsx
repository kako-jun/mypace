import geohash from 'ngeohash'
import { Icon } from '../ui'

interface PostLocationProps {
  geohashStr: string
  name?: string
}

interface TileGrid {
  tiles: { url: string; gridX: number; gridY: number }[]
  offsetX: number // pixel offset to center the coordinate
  offsetY: number
  zoom: number
}

function getTileGrid(hash: string): TileGrid | null {
  try {
    const { latitude, longitude } = geohash.decode(hash)
    const zoom = 16
    const n = Math.pow(2, zoom)
    const tileSize = 256

    // Calculate exact tile position
    const xFloat = ((longitude + 180) / 360) * n
    const yFloat =
      ((1 - Math.log(Math.tan((latitude * Math.PI) / 180) + 1 / Math.cos((latitude * Math.PI) / 180)) / Math.PI) / 2) *
      n

    const tileX = Math.floor(xFloat)
    const tileY = Math.floor(yFloat)

    // Position within tile (0-256 pixels)
    const pixelX = (xFloat - tileX) * tileSize
    const pixelY = (yFloat - tileY) * tileSize

    // Create 2x2 grid of tiles centered around the coordinate
    // We need tiles that cover the viewing area (200x130) centered on the coordinate
    const tiles: { url: string; gridX: number; gridY: number }[] = []

    // Get 4 tiles (2x2 grid) - current tile and neighbors based on position
    const startX = pixelX > tileSize / 2 ? tileX : tileX - 1
    const startY = pixelY > tileSize / 2 ? tileY : tileY - 1

    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const tx = startX + dx
        const ty = startY + dy
        tiles.push({
          url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
          gridX: dx,
          gridY: dy,
        })
      }
    }

    // Calculate offset to center the coordinate in the viewing area
    // The coordinate is at (pixelX, pixelY) within the original tile
    // In the 2x2 grid, we need to offset based on which tiles we selected
    const gridOffsetX = (tileX - startX) * tileSize + pixelX
    const gridOffsetY = (tileY - startY) * tileSize + pixelY

    return {
      tiles,
      offsetX: gridOffsetX,
      offsetY: gridOffsetY,
      zoom,
    }
  } catch {
    return null
  }
}

export function PostLocation({ geohashStr, name }: PostLocationProps) {
  const tileGrid = getTileGrid(geohashStr)

  // Calculate map URL
  let mapUrl = '#'
  try {
    const { latitude, longitude } = geohash.decode(geohashStr)
    mapUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}&zoom=17`
  } catch {
    // Invalid geohash
  }

  // Container size
  const containerWidth = 200
  const containerHeight = 130
  const tileSize = 256

  return (
    <a
      href={mapUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="post-location"
      title="View on map"
      onClick={(e) => e.stopPropagation()}
    >
      {tileGrid && (
        <div className="post-location-map-container">
          <div
            className="post-location-tiles"
            style={{
              transform: `translate(${containerWidth / 2 - tileGrid.offsetX}px, ${containerHeight / 2 - tileGrid.offsetY}px)`,
            }}
          >
            {tileGrid.tiles.map((tile, i) => (
              <img
                key={i}
                src={tile.url}
                alt=""
                className="post-location-tile"
                style={{
                  left: tile.gridX * tileSize,
                  top: tile.gridY * tileSize,
                }}
              />
            ))}
          </div>
          <div className="post-location-marker">
            <Icon name="MapPin" size={24} />
          </div>
        </div>
      )}
      <div className="post-location-info">
        <Icon name="MapPin" size={14} />
        <span>{name || geohashStr}</span>
      </div>
    </a>
  )
}
