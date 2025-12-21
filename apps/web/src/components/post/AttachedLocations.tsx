import { Icon } from '../ui'

interface Location {
  geohash: string
  name?: string
}

interface AttachedLocationsProps {
  locations: Location[]
  onRemove: (index: number) => void
}

export default function AttachedLocations({ locations, onRemove }: AttachedLocationsProps) {
  if (locations.length === 0) return null

  return (
    <div className="attached-locations">
      {locations.map((loc, index) => (
        <div key={`${loc.geohash}-${index}`} className="attached-location">
          <Icon name="MapPin" size={14} />
          <span>{loc.name || loc.geohash}</span>
          <button
            type="button"
            className="remove-location-button"
            onClick={() => onRemove(index)}
            aria-label="Remove location"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
