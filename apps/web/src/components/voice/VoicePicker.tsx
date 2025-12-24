import { useState, useRef, useCallback, useEffect } from 'react'
import { Icon, CloseButton, Portal } from '../ui'
import Button from '../ui/Button'
import { uploadImage } from '../../lib/api/upload'
import { saveUploadToHistory } from '../../lib/api'
import { getCurrentPubkey } from '../../lib/nostr/events'
import '../../styles/components/voice.css'

interface VoicePickerProps {
  onComplete: (url: string) => void
}

const MAX_DURATION = 21 // seconds

export function VoicePicker({ onComplete }: VoicePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const isRecordingRef = useRef(false)
  const justReRecordedRef = useRef(false)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cleanup
  }, [cleanup])

  // Initialize canvas with flat line when modal opens or after re-record
  useEffect(() => {
    if (!isOpen || recordedBlob) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Draw black background
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // Draw flat red line in center
    ctx.lineWidth = 2
    ctx.strokeStyle = '#f33'
    ctx.beginPath()
    ctx.moveTo(0, canvas.height / 2)
    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()
  }, [isOpen, recordedBlob])

  const handleOpen = () => {
    setIsOpen(true)
    setRecordedBlob(null)
    setDuration(0)
    setIsPlaying(false)
    setError('')
  }

  const handleClose = () => {
    cleanup()
    setIsOpen(false)
    setIsRecording(false)
    setRecordedBlob(null)
    setDuration(0)
    setIsPlaying(false)
    setError('')
  }

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current
    const analyser = analyserRef.current
    if (!canvas || !analyser) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    analyser.getByteTimeDomainData(dataArray)

    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.lineWidth = 2
    ctx.strokeStyle = '#f33'
    ctx.beginPath()

    const sliceWidth = canvas.width / bufferLength
    let x = 0

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0
      const y = (v * canvas.height) / 2

      if (i === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
      x += sliceWidth
    }

    ctx.lineTo(canvas.width, canvas.height / 2)
    ctx.stroke()

    // Use ref instead of state to check recording status
    if (isRecordingRef.current) {
      animationRef.current = requestAnimationFrame(drawWaveform)
    }
  }, [])

  const startRecording = async () => {
    setError('')
    chunksRef.current = []

    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 48000,
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      })
      streamRef.current = stream

      // Set up audio analyser for waveform
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      // Choose supported mimeType - prefer ogg for clear audio identification
      const mimeType = MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : undefined
      const recorderOptions: MediaRecorderOptions = {
        audioBitsPerSecond: 128000,
      }
      if (mimeType) {
        recorderOptions.mimeType = mimeType
      }
      const mediaRecorder = new MediaRecorder(stream, recorderOptions)
      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data)
        }
      }

      mediaRecorder.onstop = () => {
        const actualMimeType = mediaRecorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: actualMimeType })
        setRecordedBlob(blob)
        stream.getTracks().forEach((track) => track.stop())
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current)
        }
      }

      mediaRecorder.start()
      setIsRecording(true)
      isRecordingRef.current = true
      setDuration(0)

      // Start timer
      const startTime = Date.now()
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000)
        setDuration(Math.min(elapsed, MAX_DURATION))
        if (elapsed >= MAX_DURATION) {
          stopRecording()
        }
      }, 100)

      // Start waveform animation
      drawWaveform()
    } catch (err) {
      console.error('Failed to start recording:', err)
      setError('Failed to access microphone')
    }
  }

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false
    setIsRecording(false)

    // Always clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }, [])

  const handleMouseDown = () => {
    if (!recordedBlob && !justReRecordedRef.current) {
      startRecording()
    }
  }

  const handleMouseUp = () => {
    if (isRecording) {
      stopRecording()
    }
  }

  const handlePlayPause = () => {
    if (!recordedBlob) return

    if (!audioRef.current) {
      const url = URL.createObjectURL(recordedBlob)
      audioUrlRef.current = url
      audioRef.current = new Audio(url)
      audioRef.current.onended = () => setIsPlaying(false)
    }

    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.currentTime = 0
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handleReRecord = () => {
    // Prevent immediate recording after re-record
    justReRecordedRef.current = true
    setTimeout(() => {
      justReRecordedRef.current = false
    }, 300)

    setRecordedBlob(null)
    setDuration(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    setIsPlaying(false)
  }

  const handleUpload = async () => {
    if (!recordedBlob) return

    setUploading(true)
    setError('')

    try {
      const ext = recordedBlob.type.includes('ogg') ? 'ogg' : recordedBlob.type.includes('mp4') ? 'm4a' : 'webm'
      const file = new File([recordedBlob], `voice.${ext}`, { type: recordedBlob.type })
      const result = await uploadImage(file)

      if (result.success && result.url) {
        // Save to upload history (D1)
        try {
          const pubkey = await getCurrentPubkey()
          saveUploadToHistory(pubkey, result.url, file.name, 'audio')
        } catch {
          // Silently fail
        }
        // Add audio marker for webm files so they're treated as audio
        const audioUrl = result.url.endsWith('.webm') ? `${result.url}?audio` : result.url
        onComplete(audioUrl)
        handleClose()
      } else {
        setError(result.error || 'Upload failed')
      }
    } catch (err) {
      console.error('Upload error:', err)
      setError('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  const formatTime = (seconds: number) => {
    return `00:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="voice-picker">
      <button type="button" className="voice-picker-button" onClick={handleOpen} title="Voice memo">
        <Icon name="Mic" size={16} />
      </button>

      {isOpen && (
        <Portal>
          <div className="voice-picker-backdrop" onClick={handleBackdropClick}>
            <div className="voice-picker-modal" onClick={(e) => e.stopPropagation()}>
              <div className="voice-picker-header">
                <h3>Voice Memo</h3>
                <span className={`voice-picker-timer ${duration >= MAX_DURATION - 3 && isRecording ? 'warning' : ''}`}>
                  {formatTime(duration)} / {formatTime(MAX_DURATION)}
                </span>
                <CloseButton onClick={handleClose} size={20} />
              </div>

              <div className="voice-picker-content">
                {!recordedBlob ? (
                  <>
                    <canvas ref={canvasRef} className="voice-picker-waveform" width={280} height={60} />
                    <button
                      type="button"
                      className={`voice-picker-record-button ${isRecording ? 'recording' : ''}`}
                      onMouseDown={handleMouseDown}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                      onTouchStart={(e) => {
                        e.preventDefault()
                        handleMouseDown()
                      }}
                      onTouchEnd={(e) => {
                        e.preventDefault()
                        handleMouseUp()
                      }}
                    >
                      <Icon name="Mic" size={32} />
                      <span>{isRecording ? 'Recording...' : 'Hold to record'}</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="voice-picker-playback">
                      <button type="button" className="voice-picker-play-button" onClick={handlePlayPause}>
                        <Icon name={isPlaying ? 'Pause' : 'Play'} size={24} />
                      </button>
                      <div className="voice-picker-playback-info">
                        <span className="voice-picker-duration">{formatTime(duration)}</span>
                        <span className="voice-picker-format">WebM Audio</span>
                      </div>
                    </div>
                    <button type="button" className="voice-picker-rerecord" onClick={handleReRecord}>
                      <Icon name="RefreshCw" size={16} />
                      Re-record
                    </button>
                  </>
                )}
              </div>

              {error && <div className="voice-picker-error">{error}</div>}

              <div className="voice-picker-footer">
                <Button size="md" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button size="md" variant="primary" onClick={handleUpload} disabled={!recordedBlob || uploading}>
                  {uploading ? 'Uploading...' : 'Add'}
                </Button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
