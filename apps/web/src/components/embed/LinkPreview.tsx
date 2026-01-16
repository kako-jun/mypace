import { useState, useEffect } from 'react'
import { Icon, ExternalLink } from '../ui'
import { fetchOgpBatch } from '../../lib/api'
import type { OgpData } from '../../types'

interface LinkPreviewProps {
  url: string
  ogpData?: OgpData // Pre-fetched OGP data from batch API
}

export default function LinkPreview({ url, ogpData }: LinkPreviewProps) {
  const [ogp, setOgp] = useState<OgpData | undefined>(ogpData)
  const [loading, setLoading] = useState(!ogpData)
  const [imageError, setImageError] = useState(false)

  // Fetch OGP if not provided (e.g., direct access to detail page)
  // Delay fallback fetch to allow parent's batch fetch to complete first
  useEffect(() => {
    if (ogpData) {
      setOgp(ogpData)
      setLoading(false)
      return
    }

    let mounted = true
    // Wait 500ms before fallback fetch - parent batch should complete by then
    const timer = setTimeout(() => {
      if (!mounted) return
      fetchOgpBatch([url]).then((result) => {
        if (mounted) {
          setOgp(result[url])
          setLoading(false)
        }
      })
    }, 500)

    return () => {
      mounted = false
      clearTimeout(timer)
    }
  }, [url, ogpData])

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
