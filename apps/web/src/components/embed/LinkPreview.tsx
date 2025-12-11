import { useState, useEffect } from 'react'
import { Icon } from '../ui'

interface OgpData {
  title?: string
  description?: string
  image?: string
  siteName?: string
}

interface LinkPreviewProps {
  url: string
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [ogp, setOgp] = useState<OgpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let mounted = true

    const fetchOgp = async () => {
      try {
        const response = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`)
        if (!response.ok) throw new Error('Failed to fetch OGP')
        const data = await response.json()
        if (mounted) {
          setOgp(data)
          setLoading(false)
        }
      } catch {
        if (mounted) {
          setError(true)
          setLoading(false)
        }
      }
    }

    fetchOgp()

    return () => {
      mounted = false
    }
  }, [url])

  // Extract domain for fallback display
  let displayDomain = ''
  try {
    displayDomain = new URL(url).hostname
  } catch {
    displayDomain = url
  }

  if (loading) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="embed-container embed-link embed-loading">
        <div className="embed-link-content">
          <Icon name="Link" size={16} className="embed-link-icon" />
          <span className="embed-link-url">{displayDomain}</span>
        </div>
      </a>
    )
  }

  if (error || !ogp?.title) {
    // Simple link fallback
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="embed-container embed-link embed-simple">
        <Icon name="ExternalLink" size={14} />
        <span>{displayDomain}</span>
      </a>
    )
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="embed-container embed-link">
      {ogp.image && (
        <div className="embed-link-image">
          <img src={ogp.image} alt="" loading="lazy" />
        </div>
      )}
      <div className="embed-link-content">
        <span className="embed-link-title">{ogp.title}</span>
        {ogp.description && <span className="embed-link-description">{ogp.description}</span>}
        <span className="embed-link-domain">
          <Icon name="Link" size={12} />
          {ogp.siteName || displayDomain}
        </span>
      </div>
    </a>
  )
}
