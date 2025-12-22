/**
 * Detect if an image file contains animation
 * Supports GIF, WEBP, and APNG
 */
export async function isAnimatedImage(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (file.type === 'image/gif') {
    return isAnimatedGif(bytes)
  }

  if (file.type === 'image/webp') {
    return isAnimatedWebp(bytes)
  }

  if (file.type === 'image/png') {
    return isAnimatedPng(bytes)
  }

  return false
}

/**
 * Check if GIF has multiple frames
 * Look for multiple image descriptors (0x2C) or NETSCAPE extension
 */
function isAnimatedGif(bytes: Uint8Array): boolean {
  let imageCount = 0

  for (let i = 0; i < bytes.length - 1; i++) {
    // Image descriptor starts with 0x2C
    if (bytes[i] === 0x2c) {
      imageCount++
      if (imageCount > 1) return true
    }

    // Check for NETSCAPE2.0 application extension (loop indicator)
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xff && i + 14 < bytes.length) {
      const ext = String.fromCharCode(...bytes.slice(i + 3, i + 14))
      if (ext === 'NETSCAPE2.0') return true
    }
  }

  return false
}

/**
 * Check if WEBP is animated
 * Look for ANIM chunk in RIFF container
 */
function isAnimatedWebp(bytes: Uint8Array): boolean {
  // WEBP starts with RIFF....WEBP
  if (bytes.length < 12) return false

  const riff = String.fromCharCode(...bytes.slice(0, 4))
  const webp = String.fromCharCode(...bytes.slice(8, 12))

  if (riff !== 'RIFF' || webp !== 'WEBP') return false

  // Look for ANIM chunk
  for (let i = 12; i < bytes.length - 4; i++) {
    const chunk = String.fromCharCode(...bytes.slice(i, i + 4))
    if (chunk === 'ANIM') return true
  }

  return false
}

/**
 * Check if PNG is animated (APNG)
 * Look for acTL chunk
 */
function isAnimatedPng(bytes: Uint8Array): boolean {
  // PNG starts with specific signature
  if (bytes.length < 8) return false

  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== signature[i]) return false
  }

  // Look for acTL chunk (animation control)
  for (let i = 8; i < bytes.length - 4; i++) {
    const chunk = String.fromCharCode(...bytes.slice(i, i + 4))
    if (chunk === 'acTL') return true
  }

  return false
}
