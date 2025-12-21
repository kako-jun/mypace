import { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import geohash from 'ngeohash'
import { Icon, CloseButton } from '../ui'
import 'leaflet/dist/leaflet.css'

interface LocationPickerProps {
  onSelect: (geohash: string, name?: string) => void
  currentLocations?: { geohash: string; name?: string }[]
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
}

const GEOHASH_PRECISIONS = [
  { chars: 6, label: 'Area', distance: '±610m' },
  { chars: 7, label: 'Street', distance: '±76m' },
  { chars: 8, label: 'Building', distance: '±19m' },
  { chars: 9, label: 'Precise', distance: '±2m' },
]

export function LocationPicker({ onSelect, currentLocations = [] }: LocationPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [centerLocation, setCenterLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationName, setLocationName] = useState<string>('')
  const [precision, setPrecision] = useState(8)
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite'>('osm')
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const handleOpen = () => {
    setIsOpen(true)
    setQuery('')
    setResults([])
    setError('')
    setCenterLocation(null)
    setLocationName('')
  }

  const handleClose = () => {
    setIsOpen(false)
  }

  // Update center location when map moves
  const updateCenterLocation = useCallback(() => {
    if (!mapRef.current) return
    const center = mapRef.current.getCenter()
    setCenterLocation({ lat: center.lat, lng: center.lng })
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current).setView([35.6762, 139.6503], 5)
    mapRef.current = map

    // Add initial tile layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    })
    osmLayer.addTo(map)

    // Update center location on map move
    map.on('moveend', updateCenterLocation)
    map.on('zoomend', updateCenterLocation)

    // Set initial center location
    updateCenterLocation()

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [isOpen, updateCenterLocation])

  // Update tile layer
  useEffect(() => {
    if (!mapRef.current) return

    // Remove existing layers
    mapRef.current.eachLayer((layer) => {
      if (layer instanceof L.TileLayer) {
        mapRef.current?.removeLayer(layer)
      }
    })

    // Add new layer
    if (mapLayer === 'osm') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(mapRef.current)
    } else {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri',
      }).addTo(mapRef.current)
    }
  }, [mapLayer])

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return

    setSearching(true)
    setError('')
    setResults([])

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
        {
          headers: {
            'User-Agent': 'mypace/1.0',
          },
        }
      )
      if (!res.ok) throw new Error('Search failed')
      const data: NominatimResult[] = await res.json()
      setResults(data)
      if (data.length === 0) {
        setError('No results found')
      }
    } catch {
      setError('Search failed')
    } finally {
      setSearching(false)
    }
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleSelectResult = (result: NominatimResult) => {
    const lat = parseFloat(result.lat)
    const lng = parseFloat(result.lon)
    const name = result.display_name.split(',')[0]

    // Move map to the selected location
    if (mapRef.current) {
      mapRef.current.setView([lat, lng], 17)
    }

    setLocationName(name)
    setResults([])
  }

  const handleConfirm = () => {
    if (!centerLocation) return
    const hash = geohash.encode(centerLocation.lat, centerLocation.lng, precision)
    onSelect(hash, locationName || undefined)
    handleClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  return (
    <div className="location-picker">
      <button
        type="button"
        className="location-picker-button"
        onClick={handleOpen}
        title={currentLocations.length > 0 ? `${currentLocations.length} location(s)` : 'Add location'}
      >
        <Icon name="MapPin" size={16} />
      </button>

      {isOpen && (
        <div className="location-picker-backdrop" onClick={handleBackdropClick}>
          <div className="location-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="location-picker-header">
              <h3>Add Location</h3>
              <CloseButton onClick={handleClose} size={20} />
            </div>

            <div className="location-picker-search">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search for a place..."
                className="location-picker-input"
              />
              <button
                type="button"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="location-picker-search-button"
              >
                {searching ? '...' : <Icon name="Search" size={16} />}
              </button>
            </div>

            {error && <div className="location-picker-error">{error}</div>}

            {results.length > 0 && (
              <ul className="location-picker-results">
                {results.map((result) => (
                  <li key={result.place_id}>
                    <button type="button" onClick={() => handleSelectResult(result)}>
                      <Icon name="MapPin" size={14} />
                      <span>{result.display_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="location-picker-map-controls">
              <button type="button" className={mapLayer === 'osm' ? 'active' : ''} onClick={() => setMapLayer('osm')}>
                Map
              </button>
              <button
                type="button"
                className={mapLayer === 'satellite' ? 'active' : ''}
                onClick={() => setMapLayer('satellite')}
              >
                Satellite
              </button>
            </div>

            <div className="location-picker-map-wrapper">
              <div ref={mapContainerRef} className="location-picker-map" />
              <div className="location-picker-crosshair">
                <div className="crosshair-h" />
                <div className="crosshair-v" />
                <div className="crosshair-center" />
              </div>
            </div>

            <p className="location-picker-hint">Move the map to place the crosshair on your location</p>

            <div className="location-picker-precision">
              <label>Precision:</label>
              <select value={precision} onChange={(e) => setPrecision(parseInt(e.target.value, 10))}>
                {GEOHASH_PRECISIONS.map((p) => (
                  <option key={p.chars} value={p.chars}>
                    {p.label} ({p.distance})
                  </option>
                ))}
              </select>
            </div>

            <div className="location-picker-footer">
              <button type="button" className="location-picker-cancel" onClick={handleClose}>
                Cancel
              </button>
              <button
                type="button"
                className="location-picker-confirm"
                onClick={handleConfirm}
                disabled={!centerLocation}
              >
                Add Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
