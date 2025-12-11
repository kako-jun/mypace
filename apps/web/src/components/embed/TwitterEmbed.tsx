import { useEffect, useRef, useState } from 'react'
import { Icon } from '../ui'

interface TwitterEmbedProps {
  tweetId: string
  url: string
}

declare global {
  interface Window {
    twttr?: {
      widgets: {
        load: (element?: HTMLElement) => void
        createTweet: (tweetId: string, element: HTMLElement, options?: Record<string, unknown>) => Promise<HTMLElement>
      }
    }
  }
}

// Load Twitter widget script once
let twitterScriptLoaded = false
function loadTwitterScript(): Promise<void> {
  if (twitterScriptLoaded && window.twttr) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    if (document.getElementById('twitter-widget-script')) {
      // Script tag exists but may not be loaded yet
      const checkInterval = setInterval(() => {
        if (window.twttr) {
          twitterScriptLoaded = true
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.id = 'twitter-widget-script'
    script.src = 'https://platform.twitter.com/widgets.js'
    script.async = true
    script.onload = () => {
      twitterScriptLoaded = true
      resolve()
    }
    document.body.appendChild(script)
  })
}

export default function TwitterEmbed({ tweetId, url }: TwitterEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!loaded || !containerRef.current) return

    let mounted = true

    loadTwitterScript()
      .then(() => {
        if (!mounted || !containerRef.current || !window.twttr) return

        // Clear previous content
        containerRef.current.innerHTML = ''

        return window.twttr.widgets.createTweet(tweetId, containerRef.current, {
          theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
          conversation: 'none',
          dnt: true,
        })
      })
      .then((element) => {
        if (!element && mounted) {
          setError(true)
        }
      })
      .catch(() => {
        if (mounted) setError(true)
      })

    return () => {
      mounted = false
    }
  }, [loaded, tweetId])

  if (!loaded) {
    return (
      <div className="embed-container embed-twitter embed-placeholder" onClick={() => setLoaded(true)}>
        <div className="embed-placeholder-content">
          <Icon name="Twitter" size={32} />
          <span className="embed-placeholder-text">Click to load tweet</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="embed-container embed-twitter embed-error">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Icon name="Twitter" size={16} /> View tweet on X
        </a>
      </div>
    )
  }

  return <div ref={containerRef} className="embed-container embed-twitter" />
}
