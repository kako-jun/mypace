export function extractTikTokId(url: string): string | null {
  const videoMatch = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)
  if (videoMatch) return videoMatch[1]

  const shortMatch = url.match(/(?:vm|vt)\.tiktok\.com\/([a-zA-Z0-9]+)/)
  if (shortMatch) return shortMatch[1]

  return null
}
