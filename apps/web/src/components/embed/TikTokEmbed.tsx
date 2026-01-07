import { useState, useEffect, useRef } from 'react'
import { SiTiktok } from 'react-icons/si'
import { ExternalLink } from '../ui'
import EmbedPlaceholder from './EmbedPlaceholder'

interface TikTokEmbedProps {
  tiktokId: string
  url: string
}

// Load TikTok embed script once
let tiktokScriptLoaded = false
function loadTikTokScript(): Promise<void> {
  if (tiktokScriptLoaded) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    if (document.getElementById('tiktok-embed-script')) {
      tiktokScriptLoaded = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.id = 'tiktok-embed-script'
    script.src = 'https://www.tiktok.com/embed.js'
    script.async = true
    script.onload = () => {
      tiktokScriptLoaded = true
      resolve()
    }
    document.body.appendChild(script)
  })
}

export default function TikTokEmbed({ tiktokId, url }: TikTokEmbedProps) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loaded) return

    let mounted = true

    loadTikTokScript()
      .then(() => {
        if (!mounted || !containerRef.current) return
        // TikTok script will process blockquote elements automatically
      })
      .catch(() => {
        if (mounted) setError(true)
      })

    return () => {
      mounted = false
    }
  }, [loaded])

  if (!loaded) {
    return (
      <EmbedPlaceholder
        embedType="tiktok"
        icon={<SiTiktok size={32} />}
        text="Click to load TikTok"
        onClick={() => setLoaded(true)}
      />
    )
  }

  if (error) {
    return (
      <div className="embed-container embed-tiktok embed-error">
        <ExternalLink href={url}>
          <SiTiktok size={16} /> View on TikTok
        </ExternalLink>
      </div>
    )
  }

  // Check if it's a short URL (vm.tiktok.com or vt.tiktok.com)
  const isShortUrl = /(?:vm|vt)\.tiktok\.com/.test(url)

  return (
    <div ref={containerRef} className="embed-container embed-tiktok">
      {isShortUrl ? (
        // For short URLs, use iframe with the original URL
        <iframe
          src={`https://www.tiktok.com/embed/v2/${tiktokId}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        // For full URLs, use blockquote for official embed
        <blockquote
          className="tiktok-embed"
          cite={url}
          data-video-id={tiktokId}
          style={{ maxWidth: '605px', minWidth: '325px' }}
        >
          <section>
            <ExternalLink href={url}>View on TikTok</ExternalLink>
          </section>
        </blockquote>
      )}
    </div>
  )
}
