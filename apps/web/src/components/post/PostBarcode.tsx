import { useEffect, useState, useMemo } from 'react'
import { generateStats, generateBarcode, getRarity, type BarcodeStats } from '../../lib/barcode/barcode'

interface PostBarcodeProps {
  eventId: string
}

// Rarity display config: label and color
const RARITY_CONFIG = {
  common: { label: 'N', color: '#888' },
  uncommon: { label: 'R', color: '#3b82f6' },
  rare: { label: 'SR', color: '#a855f7' },
  'super-rare': { label: 'UR', color: '#eab308' },
} as const

/**
 * Display a barcode on the right edge of a post card
 * Rotated 90 degrees to appear as a vertical strip
 */
export default function PostBarcode({ eventId }: PostBarcodeProps) {
  const [stats, setStats] = useState<BarcodeStats | null>(null)

  useEffect(() => {
    generateStats(eventId).then(setStats)
  }, [eventId])

  const barcode = useMemo(() => {
    if (!stats) return null
    return generateBarcode(stats)
  }, [stats])

  const rarity = useMemo(() => {
    if (!stats) return null
    return getRarity(stats)
  }, [stats])

  if (!barcode || !rarity) return null

  // Each bit becomes a bar
  // 1 = thick black bar, 0 = thin black bar with white space
  const barWidth = 2
  const gapWidth = 1
  const totalWidth = barcode.length * (barWidth + gapWidth)
  const barHeight = 20

  const rarityConfig = RARITY_CONFIG[rarity]

  return (
    <div className="post-barcode">
      <svg width={barHeight} height={totalWidth} viewBox={`0 0 ${barHeight} ${totalWidth}`} preserveAspectRatio="none">
        {barcode.split('').map((bit, i) => {
          const y = i * (barWidth + gapWidth)
          const width = bit === '1' ? barHeight : barHeight * 0.6
          const x = bit === '1' ? 0 : barHeight * 0.2
          return <rect key={i} x={x} y={y} width={width} height={barWidth} fill="currentColor" />
        })}
      </svg>
      {/* Rarity indicator below barcode */}
      <span className="post-barcode-rarity" style={{ color: rarityConfig.color }}>
        {rarityConfig.label}
      </span>
    </div>
  )
}
