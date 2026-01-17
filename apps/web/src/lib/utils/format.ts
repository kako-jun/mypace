/**
 * Format a number with comma separators (e.g., 1000 -> "1,000")
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return '...'
  return num.toLocaleString()
}
