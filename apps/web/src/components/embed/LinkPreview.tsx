import { useState, useEffect } from 'react'
import { Icon, ExternalLink } from '../ui'
import { API_BASE } from '../../lib/api'

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
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    let mounted = true

    const fetchOgp = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/ogp?url=${encodeURIComponent(url)}`)
        if (!response.ok) throw new Error('Failed to fetch OGP')
        const data = await response.json()
        if (mounted) {
          setOgp(data)
          setImageError(false)
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
      <ExternalLink href={url} className="embed-container embed-link embed-loading">
        <div className="embed-link-content">
          <Icon name="Link" size={16} className="embed-link-icon" />
          <span className="embed-link-url">{displayDomain}</span>
        </div>
      </ExternalLink>
    )
  }

  if (error || !ogp?.title) {
    // Simple link fallback
    return (
      <ExternalLink href={url} className="embed-container embed-link embed-simple">
        <Icon name="ExternalLink" size={14} />
        <span>{displayDomain}</span>
      </ExternalLink>
    )
  }

  return (
    <ExternalLink href={url} className="embed-container embed-link">
      {ogp.image && !imageError && (
        <div className="embed-link-image">
          <img src={ogp.image} alt="" loading="lazy" onError={() => setImageError(true)} />
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
    </ExternalLink>
  )
}
