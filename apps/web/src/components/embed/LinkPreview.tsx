import { useState, useEffect } from 'react'
import { Icon, ExternalLink } from '../ui'
import { fetchOgpBatch } from '../../lib/api'
import type { OgpData } from '../../types'

interface LinkPreviewProps {
  url: string
  ogpData?: OgpData // Pre-fetched OGP data from batch API
  enableFallback?: boolean // Enable fetching if ogpData not provided (for direct page access)
}

export default function LinkPreview({ url, ogpData, enableFallback = false }: LinkPreviewProps) {
  const [ogp, setOgp] = useState<OgpData | undefined>(ogpData)
  const [loading, setLoading] = useState(!ogpData && enableFallback)
  const [imageError, setImageError] = useState(false)

  // Fetch OGP only if enableFallback is true (e.g., direct access to detail page)
  useEffect(() => {
    if (ogpData) {
      setOgp(ogpData)
      setLoading(false)
      return
    }

    // Only fetch if fallback is explicitly enabled
    if (!enableFallback) {
      setLoading(false)
      return
    }

    let mounted = true
    fetchOgpBatch([url]).then((result) => {
      if (mounted) {
        setOgp(result[url])
        setLoading(false)
      }
    })
    return () => {
      mounted = false
    }
  }, [url, ogpData, enableFallback])

  // Extract domain for fallback display
  let displayDomain = ''
  try {
    displayDomain = new URL(url).hostname
  } catch {
    displayDomain = url
  }

  // Loading state
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

  // No OGP data - show simple link
  if (!ogp?.title) {
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
