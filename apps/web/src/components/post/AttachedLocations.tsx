import geohash from 'ngeohash'
import { Icon } from '../ui'

interface Location {
  geohash: string
  name?: string
}

interface AttachedLocationsProps {
  locations: Location[]
  onRemove: (index: number) => void
}

function getStaticMapUrl(hash: string): string {
  const { latitude, longitude } = geohash.decode(hash)
  // Use OpenStreetMap tile directly - calculate tile coordinates for zoom level 15
  const zoom = 15
  const n = Math.pow(2, zoom)
  const x = Math.floor(((longitude + 180) / 360) * n)
  const y = Math.floor(
    ((1 - Math.log(Math.tan((latitude * Math.PI) / 180) + 1 / Math.cos((latitude * Math.PI) / 180)) / Math.PI) / 2) * n
  )
  return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`
}

export default function AttachedLocations({ locations, onRemove }: AttachedLocationsProps) {
  if (locations.length === 0) return null

  return (
    <div className="attached-locations">
      {locations.map((loc, index) => {
        const mapUrl = getStaticMapUrl(loc.geohash)
        return (
          <div key={`${loc.geohash}-${index}`} className="attached-location">
            <img src={mapUrl} alt="Map" className="attached-location-map" />
            <div className="attached-location-info">
              <Icon name="MapPin" size={14} />
              <span>{loc.name || loc.geohash}</span>
            </div>
            <button
              type="button"
              className="remove-location-button"
              onClick={() => onRemove(index)}
              aria-label="Remove location"
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
