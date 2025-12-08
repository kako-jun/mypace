import { useState, useEffect } from 'hono/jsx'

let openLightBox: ((src: string) => void) | null = null

export function setLightBoxHandler(handler: (src: string) => void) {
  openLightBox = handler
}

export function triggerLightBox(src: string) {
  if (openLightBox) {
    openLightBox(src)
  }
}

export default function LightBox() {
  const [isOpen, setIsOpen] = useState(false)
  const [imageSrc, setImageSrc] = useState('')

  useEffect(() => {
    setLightBoxHandler((src: string) => {
      setImageSrc(src)
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

  return (
    <div class="lightbox-backdrop" onClick={() => setIsOpen(false)}>
      <button class="lightbox-close" onClick={() => setIsOpen(false)} aria-label="Close">
        ×
      </button>
      <img src={imageSrc} alt="" class="lightbox-image" onClick={(e) => e.stopPropagation()} />
    </div>
  )
}
