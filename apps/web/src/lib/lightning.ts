/**
 * Lightning Network utilities for LNURL and WebLN payments
 */

// LNURL-pay response types
interface LnurlPayResponse {
  callback: string
  maxSendable: number // millisatoshis
  minSendable: number // millisatoshis
  metadata: string
  tag: 'payRequest'
}

interface LnurlInvoiceResponse {
  pr: string // bolt11 invoice
  routes?: unknown[]
}

/**
 * Parse lightning address (lud16) to LNURL endpoint
 * e.g., user@walletofsatoshi.com -> https://walletofsatoshi.com/.well-known/lnurlp/user
 */
function parseLightningAddress(lud16: string): string | null {
  const parts = lud16.split('@')
  if (parts.length !== 2) return null
  const [user, domain] = parts
  return `https://${domain}/.well-known/lnurlp/${user}`
}

/**
 * Fetch LNURL-pay info from lightning address
 */
async function fetchLnurlPayInfo(lud16: string): Promise<LnurlPayResponse | null> {
  const url = parseLightningAddress(lud16)
  if (!url) return null

  try {
    const response = await fetch(url)
    if (!response.ok) return null
    const data = await response.json()
    if (data.tag !== 'payRequest') return null
    return data as LnurlPayResponse
  } catch {
    return null
  }
}

/**
 * Fetch invoice from LNURL-pay callback
 */
async function fetchInvoice(callback: string, amountMsat: number): Promise<string | null> {
  try {
    const url = new URL(callback)
    url.searchParams.set('amount', amountMsat.toString())

    const response = await fetch(url.toString())
    if (!response.ok) return null
    const data: LnurlInvoiceResponse = await response.json()
    return data.pr || null
  } catch {
    return null
  }
}

/**
 * Pay a lightning invoice using WebLN
 */
async function payInvoice(invoice: string): Promise<{ success: boolean; preimage?: string; error?: string }> {
  if (!window.webln) {
    return { success: false, error: 'WebLN not available' }
  }

  if (!window.webln.sendPayment) {
    return { success: false, error: 'WebLN sendPayment not supported' }
  }

  try {
    await window.webln.enable()
    const result = await window.webln.sendPayment(invoice)
    return { success: true, preimage: result.preimage }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Payment failed' }
  }
}

/**
 * Send payment to a lightning address
 * @param lud16 Lightning address (e.g., user@walletofsatoshi.com)
 * @param amountSats Amount in satoshis
 */
export async function sendToLightningAddress(
  lud16: string,
  amountSats: number
): Promise<{ success: boolean; preimage?: string; error?: string }> {
  // Get LNURL-pay info
  const payInfo = await fetchLnurlPayInfo(lud16)
  if (!payInfo) {
    return { success: false, error: 'Invalid lightning address' }
  }

  // Convert sats to millisatoshis
  const amountMsat = amountSats * 1000

  // Check amount limits
  if (amountMsat < payInfo.minSendable || amountMsat > payInfo.maxSendable) {
    return {
      success: false,
      error: `Amount must be between ${payInfo.minSendable / 1000} and ${payInfo.maxSendable / 1000} sats`,
    }
  }

  // Fetch invoice
  const invoice = await fetchInvoice(payInfo.callback, amountMsat)
  if (!invoice) {
    return { success: false, error: 'Failed to fetch invoice' }
  }

  // Pay invoice
  return payInvoice(invoice)
}

/**
 * Price per stella by color (in satoshis)
 */
const STELLA_PRICE: Record<string, number> = {
  yellow: 0,
  green: 1,
  red: 10,
  blue: 100,
  purple: 1000,
}

/**
 * Calculate stella cost in satoshis for a single color
 */
export function getStellaCost(color: string, count: number): number {
  return (STELLA_PRICE[color] || 0) * count
}

/**
 * Calculate total cost for stella counts by color
 */
export function getTotalStellaCost(counts: {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}): number {
  return (
    counts.green * STELLA_PRICE.green +
    counts.red * STELLA_PRICE.red +
    counts.blue * STELLA_PRICE.blue +
    counts.purple * STELLA_PRICE.purple
  )
}

/**
 * Calculate cost difference when adding stella (newCounts - oldCounts)
 */
export function getStellaCostDiff(
  oldCounts: { yellow: number; green: number; red: number; blue: number; purple: number },
  newCounts: { yellow: number; green: number; red: number; blue: number; purple: number }
): number {
  const oldCost = getTotalStellaCost(oldCounts)
  const newCost = getTotalStellaCost(newCounts)
  return Math.max(0, newCost - oldCost)
}
