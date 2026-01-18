import { useState, useRef, useCallback, useEffect } from 'react'
import { CloseButton, Portal } from '../ui'
import Button from '../ui/Button'
import { videoToAnimatedWebP, getVideoDuration } from '../../lib/animatedWebpEncoder'
import '../../styles/components/video-editor.css'

interface VideoEditorProps {
  file: File
  onComplete: (editedFile: File) => void
  onCancel: () => void
  onError?: (error: string) => void
}

interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

const MAX_DURATION = 10 // seconds

export function VideoEditor({ file, onComplete, onCancel, onError }: VideoEditorProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoDuration, setVideoDuration] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)

  // Time range
  const [startTime, setStartTime] = useState(0)
  const [endTime, setEndTime] = useState(MAX_DURATION)

  // Crop state
  const [crop, setCrop] = useState<CropArea | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  // Playback state
  const [playing, setPlaying] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
  }

  // Preview playback
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
      setPlaying(true)
    }
  }

  // Crop handlers
  const getPositionFromEvent = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return null
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    }
  }, [])

  const handleDragStart = useCallback(
    (clientX: number, clientY: number) => {
      const pos = getPositionFromEvent(clientX, clientY)
      if (!pos) return
      setDragStart(pos)
      setIsDragging(true)
      setCrop(null)
    },
    [getPositionFromEvent]
  )

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !dragStart) return
      const pos = getPositionFromEvent(clientX, clientY)
      if (!pos) return

      setCrop({
        x: Math.min(dragStart.x, pos.x),
        y: Math.min(dragStart.y, pos.y),
        width: Math.abs(pos.x - dragStart.x),
        height: Math.abs(pos.y - dragStart.y),
      })
    },
    [isDragging, dragStart, getPositionFromEvent]
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
    // Remove crop if too small
    if (crop && (crop.width < 5 || crop.height < 5)) {
      setCrop(null)
    }
  }, [crop])

  // Mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      handleDragStart(e.clientX, e.clientY)
    },
    [handleDragStart]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleDragMove(e.clientX, e.clientY)
    },
    [handleDragMove]
  )

  const handleMouseUp = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  // Touch events
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        handleDragStart(touch.clientX, touch.clientY)
      }
    },
    [handleDragStart]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        handleDragMove(touch.clientX, touch.clientY)
      }
    },
    [handleDragMove]
  )

  const handleTouchEnd = useCallback(() => {
    handleDragEnd()
  }, [handleDragEnd])

  // Range slider handler - unified track with start/end markers
  const handleRangeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickPos = (e.clientX - rect.left) / rect.width
    const clickTime = clickPos * videoDuration

    // Determine which marker to move (closer one)
    const distToStart = Math.abs(clickTime - startTime)
    const distToEnd = Math.abs(clickTime - endTime)

    if (distToStart < distToEnd) {
      const newStart = Math.max(0, Math.min(clickTime, endTime - 0.5))
      setStartTime(newStart)
      if (endTime - newStart > MAX_DURATION) {
        setEndTime(newStart + MAX_DURATION)
      }
    } else {
      const newEnd = Math.min(videoDuration, Math.max(clickTime, startTime + 0.5))
      setEndTime(newEnd)
      if (newEnd - startTime > MAX_DURATION) {
        setStartTime(newEnd - MAX_DURATION)
      }
    }

    // Seek video to clicked position
    if (videoRef.current && !playing) {
      videoRef.current.currentTime = clickTime
    }
  }

  const handleMarkerDrag = (marker: 'start' | 'end') => (e: React.MouseEvent) => {
    e.stopPropagation()
    const track = e.currentTarget.parentElement
    if (!track) return

    const onMove = (moveEvent: MouseEvent) => {
      const rect = track.getBoundingClientRect()
      const pos = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width))
      const time = pos * videoDuration

      if (marker === 'start') {
        const newStart = Math.max(0, Math.min(time, endTime - 0.5))
        setStartTime(newStart)
        if (endTime - newStart > MAX_DURATION) {
          setEndTime(newStart + MAX_DURATION)
        }
        if (videoRef.current && !playing) {
          videoRef.current.currentTime = newStart
        }
      } else {
        const newEnd = Math.min(videoDuration, Math.max(time, startTime + 0.5))
        setEndTime(newEnd)
        if (newEnd - startTime > MAX_DURATION) {
          setStartTime(newEnd - MAX_DURATION)
        }
        if (videoRef.current && !playing) {
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

  // Convert to animated WebP
  const handleConfirm = async () => {
    if (!videoRef.current) return

    setProcessing(true)
    setProgress(0)

    try {
      // Calculate actual crop in pixels
      let cropPixels: { x: number; y: number; width: number; height: number } | undefined
      if (crop) {
        const video = videoRef.current
        cropPixels = {
          x: Math.round((crop.x / 100) * video.videoWidth),
          y: Math.round((crop.y / 100) * video.videoHeight),
          width: Math.round((crop.width / 100) * video.videoWidth),
          height: Math.round((crop.height / 100) * video.videoHeight),
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
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 10)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`
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
              <div
                ref={containerRef}
                className="video-editor-canvas-area"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="video-editor-video"
                  onLoadedMetadata={handleVideoLoaded}
                  muted
                  playsInline
                />
                {/* Crop overlay */}
                {crop && (
                  <>
                    <div className="video-editor-crop-overlay" />
                    <div
                      className="video-editor-crop-selection"
                      style={{
                        left: `${crop.x}%`,
                        top: `${crop.y}%`,
                        width: `${crop.width}%`,
                        height: `${crop.height}%`,
                      }}
                    />
                  </>
                )}
              </div>
            )}
          </div>

          {/* Time range controls - unified slider */}
          {videoLoaded && (
            <div className="video-editor-time-controls">
              <div className="video-editor-time-display">
                <button type="button" className="video-editor-play-btn" onClick={togglePlay}>
                  {playing ? '⏸' : '▶'}
                </button>
                <span className="video-editor-time-label">
                  {formatTime(startTime)} - {formatTime(endTime)}
                </span>
                <span className="video-editor-duration">
                  {selectedDuration.toFixed(1)}s{selectedDuration > MAX_DURATION && ' (max 10s)'}
                </span>
              </div>

              {/* Unified range slider */}
              <div className="video-editor-range-track" onClick={handleRangeClick}>
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
                  onMouseDown={handleMarkerDrag('start')}
                >
                  <span className="video-editor-marker-label">S</span>
                </div>
                {/* End marker */}
                <div
                  className="video-editor-range-marker video-editor-range-marker-end"
                  style={{ left: `${endPercent}%` }}
                  onMouseDown={handleMarkerDrag('end')}
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
