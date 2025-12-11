import { useState } from 'react'
import { Icon } from '../ui'

interface IframeEmbedProps {
  url: string
}

export default function IframeEmbed({ url }: IframeEmbedProps) {
  const [loaded, setLoaded] = useState(false)

  // Extract domain for display
  let displayDomain = ''
  try {
    displayDomain = new URL(url).hostname
  } catch {
    displayDomain = url
  }

  if (loaded) {
    return (
      <div className="embed-container embed-iframe">
        <iframe
          src={url}
          title="Embedded content"
          sandbox="allow-scripts allow-same-origin allow-pointer-lock"
          allow="fullscreen"
          loading="lazy"
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className="embed-external-link">
          <Icon name="ExternalLink" size={14} /> Open in new tab
        </a>
      </div>
    )
  }

  return (
    <div className="embed-container embed-iframe embed-placeholder" onClick={() => setLoaded(true)}>
      <div className="embed-placeholder-content">
        <Icon name="Gamepad2" size={32} />
        <span className="embed-placeholder-text">Click to load content</span>
        <span className="embed-placeholder-domain">{displayDomain}</span>
      </div>
    </div>
  )
}
