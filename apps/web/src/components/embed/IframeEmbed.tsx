import { useState } from 'react'
import { Icon, ExternalLink } from '../ui'
import EmbedPlaceholder from './EmbedPlaceholder'

interface IframeEmbedProps {
  url: string
}

export default function IframeEmbed({ url }: IframeEmbedProps) {
  const [loaded, setLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Extract domain for display
  let displayDomain = ''
  try {
    displayDomain = new URL(url).hostname
  } catch {
    displayDomain = url
  }

  if (loaded) {
    return (
      <div className={`embed-container embed-iframe ${expanded ? 'embed-iframe-expanded' : ''}`}>
        <iframe
          src={url}
          title="Embedded content"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
          allow="fullscreen"
          loading="lazy"
        />
        <div className="embed-iframe-controls">
          <button
            className="embed-expand-btn"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            <Icon name={expanded ? 'Minimize2' : 'Maximize2'} size={14} />
          </button>
          <ExternalLink href={url} className="embed-external-link">
            <Icon name="ExternalLink" size={14} />
          </ExternalLink>
        </div>
      </div>
    )
  }

  return (
    <EmbedPlaceholder
      embedType="iframe"
      iconName="Gamepad2"
      text="Click to load content"
      domain={displayDomain}
      onClick={() => setLoaded(true)}
    />
  )
}
