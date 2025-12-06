import { useState, useEffect } from 'hono/jsx'
import { fetchEvents, fetchUserProfile, publishEvent } from '../lib/nostr/relay'
import { formatTimestamp, getCurrentPubkey, createTextNote, createDeleteEvent, type Profile } from '../lib/nostr/events'
import { exportNpub } from '../lib/nostr/keys'
import type { Event } from 'nostr-tools'

interface ProfileCache {
  [pubkey: string]: Profile | null
}

export default function Timeline() {
  const [events, setEvents] = useState<Event[]>([])
  const [profiles, setProfiles] = useState<ProfileCache>({})
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const loadTimeline = async () => {
    setLoading(true)
    setError('')
    try {
      const pubkey = await getCurrentPubkey()
      setMyPubkey(pubkey)

      // Try API first (uses D1 cache on server)
      const res = await fetch('/api/timeline?limit=50')
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events)
        loadProfiles(data.events)
        return
      }
      // Fallback to direct relay connection
      const notes = await fetchEvents({ kinds: [1] }, 50)
      setEvents(notes)
      loadProfiles(notes)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }

  const loadProfiles = async (events: Event[]) => {
    const pubkeys = [...new Set(events.map(e => e.pubkey))]
    const newProfiles: ProfileCache = { ...profiles }

    for (const pubkey of pubkeys) {
      if (newProfiles[pubkey] !== undefined) continue
      try {
        const profileEvent = await fetchUserProfile(pubkey)
        if (profileEvent) {
          newProfiles[pubkey] = JSON.parse(profileEvent.content)
        } else {
          newProfiles[pubkey] = null
        }
      } catch {
        newProfiles[pubkey] = null
      }
    }

    setProfiles(newProfiles)
  }

  const getDisplayName = (pubkey: string): string => {
    const profile = profiles[pubkey]
    if (profile?.display_name) return profile.display_name
    if (profile?.name) return profile.name
    return exportNpub(pubkey).slice(0, 12) + '...'
  }

  const handleEdit = (event: Event) => {
    setEditingId(event.id)
    setEditContent(event.content)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditContent('')
  }

  const handleSaveEdit = async (originalEvent: Event) => {
    if (!editContent.trim()) return

    try {
      // Create delete request for original
      const deleteEvent = await createDeleteEvent([originalEvent.id])
      await publishEvent(deleteEvent)

      // Create new post with updated content
      const newEvent = await createTextNote(editContent.trim())
      await publishEvent(newEvent)

      setEditingId(null)
      setEditContent('')

      // Reload timeline
      setTimeout(loadTimeline, 1000)
    } catch (err) {
      console.error('Failed to edit:', err)
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
      {events.map((event) => {
        const isMyPost = myPubkey === event.pubkey
        const isEditing = editingId === event.id

        return (
          <article key={event.id} class={`post-card ${isMyPost ? 'my-post' : ''}`}>
            <header class="post-header">
              <span class="author-name">{getDisplayName(event.pubkey)}</span>
              <time class="timestamp">{formatTimestamp(event.created_at)}</time>
            </header>

            {isEditing ? (
              <div class="edit-form">
                <textarea
                  class="edit-input"
                  value={editContent}
                  onInput={(e) => setEditContent((e.target as HTMLTextAreaElement).value)}
                  rows={3}
                  maxLength={280}
                />
                <div class="edit-actions">
                  <button class="cancel-button" onClick={handleCancelEdit}>Cancel</button>
                  <button class="save-button" onClick={() => handleSaveEdit(event)}>Save</button>
                </div>
              </div>
            ) : (
              <>
                <p class="post-content">{event.content}</p>
                {isMyPost && (
                  <button class="edit-button" onClick={() => handleEdit(event)}>Edit</button>
                )}
              </>
            )}
          </article>
        )
      })}
      {events.length === 0 && <p class="empty">No posts yet</p>}
    </div>
  )
}
