import { useState, useEffect } from 'hono/jsx'
import { fetchEvents } from '../lib/nostr/relay'
import { formatTimestamp } from '../lib/nostr/events'
import { exportNpub } from '../lib/nostr/keys'
import type { Event } from 'nostr-tools'

export default function Timeline() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadTimeline = async () => {
    setLoading(true)
    setError('')
    try {
      // Try API first (uses D1 cache on server)
      const res = await fetch('/api/timeline?limit=50')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events)
        return
      }
      // Fallback to direct relay connection
      const notes = await fetchEvents({ kinds: [1] }, 50)
      setEvents(notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTimeline()

    const handleNewPost = () => {
      setTimeout(loadTimeline, 1000)
    }
    window.addEventListener('newpost', handleNewPost)
    return () => window.removeEventListener('newpost', handleNewPost)
  }, [])

  if (loading && events.length === 0) {
    return <div class="loading">Loading...</div>
  }

  if (error) {
    return (
      <div class="error-box">
        <p>{error}</p>
        <button onClick={loadTimeline}>Retry</button>
      </div>
    )
  }

  return (
    <div class="timeline">
      {events.map((event) => (
        <article key={event.id} class="post-card">
          <header class="post-header">
            <span class="pubkey">{exportNpub(event.pubkey).slice(0, 12)}...</span>
            <time class="timestamp">{formatTimestamp(event.created_at)}</time>
          </header>
          <p class="post-content">{event.content}</p>
        </article>
      ))}
      {events.length === 0 && <p class="empty">No posts yet</p>}
    </div>
  )
}
