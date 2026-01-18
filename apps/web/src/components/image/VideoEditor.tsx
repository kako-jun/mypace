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
  const [currentTime, setCurrentTime] = useState(0)

  // Crop state
  const [crop, setCrop] = useState<CropArea | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)

  // Processing state
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

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

  // Sync video time with slider
  useEffect(() => {
    if (videoRef.current && videoLoaded) {
      videoRef.current.currentTime = currentTime
    }
  }, [currentTime, videoLoaded])

  const handleVideoLoaded = () => {
    setVideoLoaded(true)
    setCurrentTime(startTime)
  }

  // Preview playback
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing || !videoRef.current) return

    const video = videoRef.current
    video.currentTime = startTime
    video.play()

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime)
      if (video.currentTime >= endTime) {
        video.pause()
        video.currentTime = startTime
        setPlaying(false)
        setCurrentTime(startTime)
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

  // Crop handlers - shared logic
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

  const clearCrop = () => setCrop(null)

  // Time slider handlers
  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    setStartTime(value)
    if (value > endTime - 0.5) {
      setEndTime(Math.min(value + 0.5, videoDuration))
    }
    if (endTime - value > MAX_DURATION) {
      setEndTime(value + MAX_DURATION)
    }
    setCurrentTime(value)
  }

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    setEndTime(value)
    if (value < startTime + 0.5) {
      setStartTime(Math.max(value - 0.5, 0))
    }
    if (value - startTime > MAX_DURATION) {
      setStartTime(value - MAX_DURATION)
    }
  }

  const handleCurrentTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    setCurrentTime(value)
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

          {/* Time range controls */}
          {videoLoaded && (
            <div className="video-editor-time-controls">
              <div className="video-editor-time-display">
                <span className="video-editor-time-label">
                  {formatTime(startTime)} → {formatTime(endTime)}
                </span>
                <span className="video-editor-duration">
                  ({selectedDuration.toFixed(1)}s / {MAX_DURATION}s max)
                </span>
              </div>

              {/* Current time slider */}
              <div className="video-editor-slider-row">
                <button type="button" className="video-editor-play-btn" onClick={togglePlay}>
                  {playing ? '⏸' : '▶'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  value={currentTime}
                  onChange={handleCurrentTimeChange}
                  className="video-editor-slider video-editor-current-slider"
                />
              </div>

              {/* Range sliders */}
              <div className="video-editor-range-row">
                <div className="video-editor-range-label">Start</div>
                <input
                  type="range"
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  value={startTime}
                  onChange={handleStartTimeChange}
                  className="video-editor-slider video-editor-start-slider"
                />
              </div>
              <div className="video-editor-range-row">
                <div className="video-editor-range-label">End</div>
                <input
                  type="range"
                  min={0}
                  max={videoDuration}
                  step={0.1}
                  value={endTime}
                  onChange={handleEndTimeChange}
                  className="video-editor-slider video-editor-end-slider"
                />
              </div>
            </div>
          )}

          {/* Crop info */}
          {videoLoaded && (
            <div className="video-editor-crop-info">
              {crop ? (
                <>
                  <span>
                    Crop: {Math.round(crop.width)}% × {Math.round(crop.height)}%
                  </span>
                  <button type="button" className="video-editor-clear-crop" onClick={clearCrop}>
                    Clear
                  </button>
                </>
              ) : (
                <span className="video-editor-crop-hint">Drag on video to crop (optional)</span>
              )}
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
              {processing ? 'Converting...' : 'Convert'}
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
