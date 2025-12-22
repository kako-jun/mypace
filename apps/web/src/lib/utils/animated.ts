/**
 * Helper to get ASCII string from bytes
 */
function getString(bytes: Uint8Array, offset: number, length: number): string {
  let result = ''
  for (let i = 0; i < length && offset + i < bytes.length; i++) {
    result += String.fromCharCode(bytes[offset + i])
  }
  return result
}

/**
 * Detect if an image file contains animation
 * Supports GIF, WEBP, and APNG
 */
export async function isAnimatedImage(file: File): Promise<boolean> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Check by file content, not just MIME type
  if (isAnimatedGif(bytes)) return true
  if (isAnimatedWebp(bytes)) return true
  if (isAnimatedPng(bytes)) return true

  return false
}

/**
 * Check if GIF has multiple frames
 * Look for multiple image descriptors (0x2C) or NETSCAPE extension
 */
function isAnimatedGif(bytes: Uint8Array): boolean {
  // GIF signature: GIF87a or GIF89a
  if (bytes.length < 6) return false
  const sig = getString(bytes, 0, 3)
  if (sig !== 'GIF') return false

  let imageCount = 0

  for (let i = 0; i < bytes.length - 1; i++) {
    // Image descriptor starts with 0x2C
    if (bytes[i] === 0x2c) {
      imageCount++
      if (imageCount > 1) return true
    }

    // Check for NETSCAPE2.0 application extension (loop indicator)
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xff && i + 14 < bytes.length) {
      const ext = getString(bytes, i + 3, 11)
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

  const riff = getString(bytes, 0, 4)
  const webp = getString(bytes, 8, 4)

  if (riff !== 'RIFF' || webp !== 'WEBP') return false

  // Look for ANIM chunk
  for (let i = 12; i < bytes.length - 4; i++) {
    if (getString(bytes, i, 4) === 'ANIM') return true
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
    if (getString(bytes, i, 4) === 'acTL') return true
  }

  return false
}
