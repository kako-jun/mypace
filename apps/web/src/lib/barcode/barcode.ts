/**
 * Barcode Battler - Generate barcode stats from event ID
 * Based on the plan in .claude/plans/barcode-battler.md
 */

export interface BarcodeStats {
  atk: number // 0-99
  def: number // 0-99
  spd: number // 0-99
  parity: number // (atk + def + spd) % 10
}

/**
 * Generate a SHA-256 hash from a string
 */
async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Generate barcode stats from event ID
 * Same input always produces same output (deterministic)
 * Content is not used - editing a post won't change its barcode
 */
export async function generateStats(eventId: string): Promise<BarcodeStats> {
  const hash = await sha256(eventId)

  // Split hash into 3 parts for ATK, DEF, SPD
  const atk = parseInt(hash.slice(0, 8), 16) % 100
  const def = parseInt(hash.slice(8, 16), 16) % 100
  const spd = parseInt(hash.slice(16, 24), 16) % 100

  // Parity for integrity check
  const parity = (atk + def + spd) % 10

  return { atk, def, spd, parity }
}

/**
 * Generate binary barcode string from stats
 * Format: | ATK(7bit) | DEF(7bit) | SPD(7bit) | PARITY(4bit) | CHECK(3bit) |
 * Total: 28 bits
 */
export function generateBarcode(stats: BarcodeStats): string {
  const { atk, def, spd, parity } = stats

  // 7 bits each + 4 bit parity = 25 bits
  const binary =
    atk.toString(2).padStart(7, '0') +
    def.toString(2).padStart(7, '0') +
    spd.toString(2).padStart(7, '0') +
    parity.toString(2).padStart(4, '0')

  // 3-bit checksum (XOR of all bits)
  const checksum = binary.split('').reduce((a, b) => a ^ parseInt(b), 0)

  return binary + checksum.toString(2).padStart(3, '0')
}

/**
 * Get rarity based on total stats (N/R/SR/UR)
 * N: 0-149 (~50%), R: 150-199 (~33%), SR: 200-249 (~15%), UR: 250+ (~2%)
 */
export function getRarity(stats: BarcodeStats): 'common' | 'uncommon' | 'rare' | 'super-rare' {
  const total = stats.atk + stats.def + stats.spd

  if (total >= 250) return 'super-rare' // UR
  if (total >= 200) return 'rare' // SR
  if (total >= 150) return 'uncommon' // R
  return 'common' // N
}
