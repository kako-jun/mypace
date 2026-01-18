import { useState, useRef, useCallback, useEffect } from 'react'
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { CloseButton, Portal, Icon } from '../ui'
import Button from '../ui/Button'
import { videoToAnimatedWebP, getVideoDuration } from '../../lib/animatedWebpEncoder'
import '../../styles/components/video-editor.css'

interface VideoEditorProps {
  file: File
  onComplete: (editedFile: File) => void
  onCancel: () => void
  onError?: (error: string) => void
}

const MAX_DURATION = 10 // seconds

// Snap time to 0.1 second increments
const snapToTenth = (time: number) => Math.round(time * 10) / 10

export function VideoEditor({ file, onComplete, onCancel, onError }: VideoEditorProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Time range
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(MAX_DURATION)

  // Crop state (using react-image-crop)
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  // Playback state
  const [playing, setPlaying] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Load video
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setVideoUrl(url)

    getVideoDuration(file)
      .then((duration) => {
        setVideoDuration(duration)
        setEndTime(Math.min(duration, MAX_DURATION))
      })
      .catch(() => {
        onError?.('Failed to load video')
        onCancel()
      })

    return () => URL.revokeObjectURL(url)
  }, [file, onError, onCancel])

  const handleVideoLoaded = () => {
    setVideoLoaded(true)
    if (videoRef.current) {
      videoRef.current.currentTime = startTime
    }
    // Set initial crop to full frame (like ImageEditor)
    requestAnimationFrame(() => {
      setCrop({
        unit: '%',
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      })
    })
  }

  const handleCropComplete = useCallback((c: PixelCrop) => {
    setCompletedCrop(c)
  }, [])

  // Preview playback - plays within selected range
  useEffect(() => {
    if (!playing || !videoRef.current) return

    const video = videoRef.current
    video.currentTime = startTime
    video.play()

    const handleTimeUpdate = () => {
      if (video.currentTime >= endTime) {
        video.pause()
        video.currentTime = startTime
        setPlaying(false)
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.pause()
    }
  }, [playing, startTime, endTime])

  const togglePlay = () => {
    if (playing) {
      videoRef.current?.pause()
      setPlaying(false)
    } else {
      // Always start from startTime when play is pressed
      if (videoRef.current) {
        videoRef.current.currentTime = startTime
      }
      setPlaying(true)
    }
  }

  // Range slider - click on track to move nearest marker
  const handleRangeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks directly on the track, not on markers
    if ((e.target as HTMLElement).classList.contains('video-editor-range-marker')) {
      return
    }

    const rect = e.currentTarget.getBoundingClientRect()
    const clickPos = (e.clientX - rect.left) / rect.width
    const clickTime = clickPos * videoDuration

    // Determine which marker to move (closer one)
    const distToStart = Math.abs(clickTime - startTime)
    const distToEnd = Math.abs(clickTime - endTime)

    if (distToStart < distToEnd) {
      const newStart = snapToTenth(Math.max(0, Math.min(clickTime, endTime - 0.1)))
      setStartTime(newStart)
      if (endTime - newStart > MAX_DURATION) {
        setEndTime(snapToTenth(newStart + MAX_DURATION))
      }
      if (videoRef.current && !playing) {
        videoRef.current.currentTime = newStart
      }
    } else {
      const newEnd = snapToTenth(Math.min(videoDuration, Math.max(clickTime, startTime + 0.1)))
      setEndTime(newEnd)
      if (newEnd - startTime > MAX_DURATION) {
        setStartTime(snapToTenth(newEnd - MAX_DURATION))
      }
      if (videoRef.current && !playing) {
        videoRef.current.currentTime = newEnd
      }
    }
  }

  // Marker drag handlers
  const handleMarkerMouseDown = (marker: 'start' | 'end') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Stop playback and preview at marker position
    if (playing) {
      videoRef.current?.pause()
      setPlaying(false)
    }

    const track = trackRef.current
    if (!track) return

    const onMove = (moveEvent: MouseEvent) => {
      const rect = track.getBoundingClientRect()
      const pos = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
      const time = pos * videoDuration

      if (marker === 'start') {
        const newStart = snapToTenth(Math.max(0, Math.min(time, endTime - 0.1)))
        setStartTime(newStart)
        if (endTime - newStart > MAX_DURATION) {
          setEndTime(snapToTenth(newStart + MAX_DURATION))
        }
        if (videoRef.current) {
          videoRef.current.currentTime = newStart
        }
      } else {
        const newEnd = snapToTenth(Math.min(videoDuration, Math.max(time, startTime + 0.1)))
        setEndTime(newEnd)
        if (newEnd - startTime > MAX_DURATION) {
          setStartTime(snapToTenth(newEnd - MAX_DURATION))
        }
        if (videoRef.current) {
          videoRef.current.currentTime = newEnd
        }
      }
    }

    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const handleMarkerTouchStart = (marker: 'start' | 'end') => (e: React.TouchEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Stop playback and preview at marker position
    if (playing) {
      videoRef.current?.pause()
      setPlaying(false)
    }

    const track = trackRef.current
    if (!track) return

    const onMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return
      const touch = moveEvent.touches[0]
      const rect = track.getBoundingClientRect()
      const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width))
      const time = pos * videoDuration

      if (marker === 'start') {
        const newStart = snapToTenth(Math.max(0, Math.min(time, endTime - 0.1)))
        setStartTime(newStart)
        if (endTime - newStart > MAX_DURATION) {
          setEndTime(snapToTenth(newStart + MAX_DURATION))
        }
        if (videoRef.current) {
          videoRef.current.currentTime = newStart
        }
      } else {
        const newEnd = snapToTenth(Math.min(videoDuration, Math.max(time, startTime + 0.1)))
        setEndTime(newEnd)
        if (newEnd - startTime > MAX_DURATION) {
          setStartTime(snapToTenth(newEnd - MAX_DURATION))
        }
        if (videoRef.current) {
          videoRef.current.currentTime = newEnd
        }
      }
    }

    const onEnd = () => {
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
    }

    document.addEventListener('touchmove', onMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  // Convert to animated WebP
  const handleConfirm = async () => {
    if (!videoRef.current) return

    setProcessing(true)
    setProgress(0)

    try {
      // Calculate actual crop in pixels
      let cropPixels: { x: number; y: number; width: number; height: number } | undefined

      if (completedCrop) {
        const video = videoRef.current
        const scaleX = video.videoWidth / video.clientWidth
        const scaleY = video.videoHeight / video.clientHeight

        // Check if it's full image (no actual crop)
        const isFullVideo =
          completedCrop.x <= 1 &&
          completedCrop.y <= 1 &&
          Math.abs(completedCrop.width - video.clientWidth) <= 2 &&
          Math.abs(completedCrop.height - video.clientHeight) <= 2

        if (!isFullVideo) {
          cropPixels = {
            x: Math.round(completedCrop.x * scaleX),
            y: Math.round(completedCrop.y * scaleY),
            width: Math.round(completedCrop.width * scaleX),
            height: Math.round(completedCrop.height * scaleY),
          }
        }
      }

      const webpFile = await videoToAnimatedWebP(file, {
        startTime,
        endTime,
        crop: cropPixels,
        fps: 10,
        maxDimension: 320,
        onProgress: setProgress,
      })

      if (webpFile) {
        onComplete(webpFile)
      }
    } catch (error) {
      console.error('Failed to convert video:', error)
      onError?.(error instanceof Error ? error.message : 'Failed to convert video')
    } finally {
      setProcessing(false)
    }
  }

  const formatTime = (seconds: number) => {
    const secs = Math.floor(seconds)
    const tenths = Math.floor((seconds % 1) * 10)
    return `${secs.toString().padStart(2, '0')}.${tenths}`
  }

  const selectedDuration = endTime - startTime
  const startPercent = videoDuration > 0 ? (startTime / videoDuration) * 100 : 0
  const endPercent = videoDuration > 0 ? (endTime / videoDuration) * 100 : 100

  return (
    <Portal>
      <div className="video-editor-backdrop" onClick={onCancel}>
        <div className="video-editor-modal" onClick={(e) => e.stopPropagation()}>
          <div className="video-editor-header">
            <h3>Edit Video</h3>
            <CloseButton onClick={onCancel} size={20} />
          </div>

          {!videoLoaded && <div className="video-editor-loading">Loading...</div>}

          <div className="video-editor-content" style={{ display: videoLoaded ? 'flex' : 'none' }}>
            {videoUrl && (
              <div className="video-editor-canvas-area">
                <ReactCrop
                  crop={crop}
                  onChange={(c) => setCrop(c)}
                  onComplete={handleCropComplete}
                  className="video-editor-crop-container"
                  keepSelection
                >
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    className="video-editor-video"
                    onLoadedMetadata={handleVideoLoaded}
                    muted
                    playsInline
                  />
                </ReactCrop>
              </div>
            )}
          </div>

          {/* Time range controls - unified slider */}
          {videoLoaded && (
            <div className="video-editor-time-controls">
              <div className="video-editor-time-display">
                <button type="button" className="video-editor-play-btn" onClick={togglePlay}>
                  <Icon name={playing ? 'Pause' : 'Play'} size={16} />
                </button>
                <span className="video-editor-time-label">
                  {formatTime(startTime)} - {formatTime(endTime)}
                </span>
                <span className="video-editor-duration">
                  {selectedDuration.toFixed(1)}s{selectedDuration > MAX_DURATION && ' (max 10s)'}
                </span>
              </div>

              {/* Unified range slider */}
              <div ref={trackRef} className="video-editor-range-track" onClick={handleRangeClick}>
                {/* Selected range highlight */}
                <div
                  className="video-editor-range-selected"
                  style={{
                    left: `${startPercent}%`,
                    width: `${endPercent - startPercent}%`,
                  }}
                />
                {/* Start marker */}
                <div
                  className="video-editor-range-marker video-editor-range-marker-start"
                  style={{ left: `${startPercent}%` }}
                  onMouseDown={handleMarkerMouseDown('start')}
                  onTouchStart={handleMarkerTouchStart('start')}
                >
                  <span className="video-editor-marker-label">S</span>
                </div>
                {/* End marker */}
                <div
                  className="video-editor-range-marker video-editor-range-marker-end"
                  style={{ left: `${endPercent}%` }}
                  onMouseDown={handleMarkerMouseDown('end')}
                  onTouchStart={handleMarkerTouchStart('end')}
                >
                  <span className="video-editor-marker-label">E</span>
                </div>
              </div>
            </div>
          )}

          {/* Progress bar */}
          {processing && (
            <div className="video-editor-progress">
              <div className="video-editor-progress-bar" style={{ width: `${progress * 100}%` }} />
              <span className="video-editor-progress-text">Converting... {Math.round(progress * 100)}%</span>
            </div>
          )}

          <div className="video-editor-footer">
            <Button size="md" variant="secondary" onClick={onCancel} disabled={processing}>
              Cancel
            </Button>
            <Button size="md" variant="primary" onClick={handleConfirm} disabled={!videoLoaded || processing}>
              {processing ? 'Converting...' : 'Add'}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
