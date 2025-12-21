import { useState, useEffect, useRef, useCallback } from 'react'
import L from 'leaflet'
import geohash from 'ngeohash'
import { Icon } from '../ui'
import 'leaflet/dist/leaflet.css'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet default marker icon issue with bundlers
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

interface LocationPickerProps {
  onSelect: (geohash: string, name?: string) => void
  onClose: () => void
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

export function LocationPicker({ onSelect, onClose }: LocationPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; name: string } | null>(null)
  const [precision, setPrecision] = useState(8)
  const [mapLayer, setMapLayer] = useState<'osm' | 'satellite'>('osm')
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current).setView([35.6762, 139.6503], 5)
    mapRef.current = map

    // Add initial tile layer
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    })
    osmLayer.addTo(map)

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

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

  // Update marker when location changes
  useEffect(() => {
    if (!mapRef.current || !selectedLocation) return

    if (markerRef.current) {
      markerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lng])
    } else {
      const marker = L.marker([selectedLocation.lat, selectedLocation.lng], {
        draggable: true,
      })
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        setSelectedLocation((prev) => (prev ? { ...prev, lat: pos.lat, lng: pos.lng } : null))
      })
      marker.addTo(mapRef.current)
      markerRef.current = marker
    }

    mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 17)
  }, [selectedLocation])

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
    setSelectedLocation({
      lat: parseFloat(result.lat),
      lng: parseFloat(result.lon),
      name: result.display_name.split(',')[0],
    })
    setResults([])
  }

  const handleConfirm = () => {
    if (!selectedLocation) return
    const hash = geohash.encode(selectedLocation.lat, selectedLocation.lng, precision)
    onSelect(hash, selectedLocation.name)
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="location-picker-backdrop" onClick={handleBackdropClick}>
      <div className="location-picker-modal">
        <div className="location-picker-header">
          <h3>Add Location</h3>
          <button type="button" className="location-picker-close" onClick={onClose}>
            <Icon name="X" size={20} />
          </button>
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

        <div ref={mapContainerRef} className="location-picker-map" />

        {selectedLocation && (
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
        )}

        <div className="location-picker-footer">
          <button type="button" className="location-picker-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="location-picker-confirm"
            onClick={handleConfirm}
            disabled={!selectedLocation}
          >
            Add Location
          </button>
        </div>
      </div>
    </div>
  )
}
