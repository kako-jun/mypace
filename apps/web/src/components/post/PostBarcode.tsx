import { useEffect, useState, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { generateStats, getRarity, type BarcodeStats } from '../../lib/barcode/barcode'

interface PostBarcodeProps {
  eventId: string
}

// Rarity display config: label only (color matches barcode via CSS)
const RARITY_LABEL = {
  normal: 'N',
  rare: 'R',
  'super-rare': 'SR',
  'ultra-rare': 'UR',
} as const

/**
 * Convert stats to a barcode-friendly string
 * Format: AADDSS (ATK 2 digits, DEF 2 digits, SPD 2 digits)
 */
function statsToCode(stats: BarcodeStats): string {
  const atk = stats.atk.toString().padStart(2, '0')
  const def = stats.def.toString().padStart(2, '0')
  const spd = stats.spd.toString().padStart(2, '0')
  return `${atk}${def}${spd}`
}

/**
 * Display a Code 128 barcode on the right edge of a post card
 */
export default function PostBarcode({ eventId }: PostBarcodeProps) {
  const [stats, setStats] = useState<BarcodeStats | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    generateStats(eventId).then(setStats)
  }, [eventId])

  useEffect(() => {
    if (!stats || !svgRef.current) return

    const code = statsToCode(stats)

    JsBarcode(svgRef.current, code, {
      format: 'CODE128',
      width: 1,
      height: 18,
      displayValue: false,
      margin: 0,
      background: 'transparent',
      lineColor: 'currentColor',
    })
  }, [stats])

  const rarity = stats ? getRarity(stats) : null

  if (!stats || !rarity) return null

  return (
    <div className="post-barcode">
      <svg ref={svgRef} />
      <span className="post-barcode-rarity">{RARITY_LABEL[rarity]}</span>
    </div>
  )
}
