/**
 * Animated WebP Encoder
 * Uses wasm-webp to convert video frames to animated WebP
 */
import { encodeAnimation } from 'wasm-webp'

export interface VideoToWebPOptions {
  /** Start time in seconds */
  startTime: number
  /** End time in seconds */
  endTime: number
  /** Crop area (optional) */
  crop?: {
    x: number
    y: number
    width: number
    height: number
  }
  /** Rotation in degrees (-90 to 90) */
  rotation?: number
  /** Target FPS (default: 24) */
  fps?: number
  /** Max dimension for output (default: 320) */
  maxDimension?: number
  /** Progress callback */
  onProgress?: (progress: number) => void
}

interface WebPAnimationFrame {
  data: Uint8Array
  duration: number
}

/**
 * Extract frames from video and encode to animated WebP
 */
export async function videoToAnimatedWebP(videoFile: File, options: VideoToWebPOptions): Promise<File | null> {
  const { startTime, endTime, crop, rotation = 0, fps = 24, maxDimension = 320, onProgress } = options

  // Validate time range (max 10 seconds)
  const duration = Math.min(endTime - startTime, 10)
  if (duration <= 0) {
    throw new Error('Invalid time range')
  }

  // Create video element
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true

  // Load video
  const videoUrl = URL.createObjectURL(videoFile)
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Failed to load video'))
      video.src = videoUrl
    })

    // Calculate output dimensions
    let sourceWidth = video.videoWidth
    let sourceHeight = video.videoHeight
    let sourceX = 0
    let sourceY = 0

    if (crop) {
      sourceX = crop.x
      sourceY = crop.y
      sourceWidth = crop.width
      sourceHeight = crop.height
    }

    // Scale to max dimension while maintaining aspect ratio
    let outputWidth = sourceWidth
    let outputHeight = sourceHeight
    if (sourceWidth > maxDimension || sourceHeight > maxDimension) {
      if (sourceWidth > sourceHeight) {
        outputWidth = maxDimension
        outputHeight = Math.round((sourceHeight / sourceWidth) * maxDimension)
      } else {
        outputHeight = maxDimension
        outputWidth = Math.round((sourceWidth / sourceHeight) * maxDimension)
      }
    }
    // Ensure even dimensions (required for some codecs)
    outputWidth = Math.floor(outputWidth / 2) * 2
    outputHeight = Math.floor(outputHeight / 2) * 2

    // Create canvas for frame extraction
    const canvas = document.createElement('canvas')
    canvas.width = outputWidth
    canvas.height = outputHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Calculate frame count and interval
    const frameCount = Math.ceil(duration * fps)
    const frameDuration = Math.round(1000 / fps) // milliseconds

    const frames: WebPAnimationFrame[] = []

    // Extract frames
    for (let i = 0; i < frameCount; i++) {
      const time = startTime + i / fps

      // Seek to frame
      await seekVideo(video, time)

      // Draw frame to canvas (with crop, scale, and rotation)
      // Important: Apply crop FIRST, then rotation
      // This ensures the cropped region is rotated, not that the rotation affects crop coordinates
      if (rotation !== 0) {
        // Step 1: Draw cropped region to a temporary canvas (no rotation)
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = outputWidth
        tempCanvas.height = outputHeight
        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })
        if (tempCtx) {
          tempCtx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight)

          // Step 2: Draw temporary canvas to final canvas with rotation
          ctx.save()
          const radians = (rotation * Math.PI) / 180
          ctx.translate(outputWidth / 2, outputHeight / 2)
          ctx.rotate(radians)
          ctx.translate(-outputWidth / 2, -outputHeight / 2)
          ctx.drawImage(tempCanvas, 0, 0)
          ctx.restore()
        }
      } else {
        // No rotation - draw directly
        ctx.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight)
      }

      // Get RGBA data
      const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight)
      frames.push({
        data: new Uint8Array(imageData.data),
        duration: frameDuration,
      })

      // Report progress
      if (onProgress) {
        onProgress((i + 1) / frameCount)
      }
    }

    // Encode to animated WebP
    const webpData = await encodeAnimation(outputWidth, outputHeight, true, frames)
    if (!webpData) {
      throw new Error('Failed to encode WebP')
    }

    // Create file
    const blob = new Blob([new Uint8Array(webpData)], { type: 'image/webp' })
    const filename = videoFile.name.replace(/\.[^.]+$/, '') + '.webp'
    return new File([blob], filename, { type: 'image/webp' })
  } finally {
    URL.revokeObjectURL(videoUrl)
  }
}

/**
 * Seek video to specific time and wait for frame to be ready
 */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      resolve()
    }
    const onError = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      reject(new Error('Seek failed'))
    }
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    video.currentTime = time
  })
}

/**
 * Get video duration
 */
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(video.duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
    video.src = url
  })
}

/**
 * Get video dimensions
 */
export function getVideoDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve({ width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video'))
    }
    video.src = url
  })
}
