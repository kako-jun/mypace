import { useState, useEffect } from 'react'
import '../../styles/components/lightbox.css'

type MediaType = 'image' | 'video' | 'audio'

let openLightBox: ((src: string, type?: MediaType) => void) | null = null

export function setLightBoxHandler(handler: (src: string, type?: MediaType) => void) {
  openLightBox = handler
}

export function triggerLightBox(src: string, type?: MediaType) {
  if (openLightBox) {
    openLightBox(src, type)
  }
}

function detectMediaType(src: string): MediaType {
  const lower = src.toLowerCase()
  if (/\.(mp4|webm|mov|avi|mkv)(\?|$)/.test(lower)) return 'video'
  if (/\.(mp3|wav|ogg|m4a|aac|flac)(\?|$)/.test(lower)) return 'audio'
  return 'image'
}

export function LightBox() {
  const [isOpen, setIsOpen] = useState(false)
  const [mediaSrc, setMediaSrc] = useState('')
  const [mediaType, setMediaType] = useState<MediaType>('image')

  useEffect(() => {
    setLightBoxHandler((src: string, type?: MediaType) => {
      setMediaSrc(src)
      setMediaType(type || detectMediaType(src))
      setIsOpen(true)
    })

    return () => {
      openLightBox = null
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!isOpen) return null

  const renderMedia = () => {
    switch (mediaType) {
      case 'video':
        return (
          <video src={mediaSrc} className="lightbox-video" controls autoPlay onClick={(e) => e.stopPropagation()} />
        )
      case 'audio':
        return (
          <audio src={mediaSrc} className="lightbox-audio" controls autoPlay onClick={(e) => e.stopPropagation()} />
        )
      default:
        return <img src={mediaSrc} alt="" className="lightbox-image" onClick={(e) => e.stopPropagation()} />
    }
  }

  return (
    <div className="lightbox-backdrop" onClick={() => setIsOpen(false)}>
      <button className="lightbox-close" onClick={() => setIsOpen(false)} aria-label="Close">
        ×
      </button>
      {renderMedia()}
    </div>
  )
}
