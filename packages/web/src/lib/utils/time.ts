// Get current Unix timestamp in seconds
export function unixNow(): number {
  return Math.floor(Date.now() / 1000)
}
