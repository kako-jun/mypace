import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { PostHeader, PostContent, PostStickers } from '../components/post'
import { parseEmojiTags, Loading, ErrorMessage } from '../components/ui'
import { fetchEventById, fetchEvents, fetchUserProfile } from '../lib/nostr/relay'
import { fetchUserEvents } from '../lib/api'
import { getEventThemeColors, getThemeCardProps } from '../lib/nostr/events'
import { parseStickers } from '../lib/nostr/tags'
import { getDisplayName, getAvatarUrl } from '../lib/utils'
import '../styles/components/post-card.css'
import '../styles/components/embed-card.css'
import type { Event, Profile } from '../types'

const MYPACE_URL = 'https://mypace.llll-ll.com'

function decodeNoteId(id: string): string {
  try {
    if (id.startsWith('note1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'note') {
        return decoded.data as string
      }
    }
    if (id.startsWith('nevent1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'nevent') {
        return (decoded.data as { id: string }).id
      }
    }
  } catch {}
  return id
}

function decodePubkey(key: string): string {
  try {
    if (key.startsWith('npub1')) {
      const decoded = nip19.decode(key)
      if (decoded.type === 'npub') {
        return decoded.data as string
      }
    }
  } catch {}
  return key
}

export function EmbedPage() {
  const { noteId } = useParams<{ noteId: string }>()
  const [searchParams] = useSearchParams()
  const theme = searchParams.get('theme') || 'auto'
  const pubkey = searchParams.get('pubkey')

  const [event, setEvent] = useState<Event | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Apply theme (light or dark, default light)
  useEffect(() => {
    const appliedTheme = theme === 'dark' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', appliedTheme)
  }, [theme])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')

      try {
        let eventData: Event | null = null

        if (noteId === 'latest') {
          // Fetch latest post (from specific user if pubkey provided)
          if (pubkey) {
            const decodedPubkey = decodePubkey(pubkey)
            const result = await fetchUserEvents(decodedPubkey, { limit: 1 })
            eventData = result.events[0] || null
          } else {
            const events = await fetchEvents({ limit: 1 })
            eventData = events[0] || null
          }
        } else if (noteId) {
          // Fetch specific post
          const decodedId = decodeNoteId(noteId)
          eventData = await fetchEventById(decodedId)
        }

        if (!eventData) {
          setError('Post not found')
          setLoading(false)
          return
        }

        setEvent(eventData)

        // Fetch profile
        const userProfile = await fetchUserProfile(eventData.pubkey)
        if (userProfile) {
          setProfile(userProfile)
        }
      } catch (err) {
        setError('Failed to load post')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [noteId, pubkey])

  // Notify parent iframe of height changes
  useEffect(() => {
    if (!loading && !error) {
      const sendHeight = () => {
        const height = document.body.scrollHeight
        window.parent.postMessage({ type: 'mypace-embed-height', height }, '*')
      }
      // Send initial height
      sendHeight()
      // Send height after images load
      const images = document.querySelectorAll('img')
      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener('load', sendHeight)
        }
      })
      // Send height on resize
      window.addEventListener('resize', sendHeight)
      return () => window.removeEventListener('resize', sendHeight)
    }
  }, [loading, error, event])

  const handleCardClick = () => {
    if (event) {
      window.open(`${MYPACE_URL}/post/${event.id}`, '_blank')
    }
  }

  if (loading) {
    return (
      <div className="embed-page">
        <Loading />
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="embed-page">
        <ErrorMessage variant="box">{error || 'Post not found'}</ErrorMessage>
      </div>
    )
  }

  const themeProps = getThemeCardProps(getEventThemeColors(event))
  const stickers = parseStickers(event.tags)

  return (
    <div className="embed-page">
      <article
        className={`post-card embed-card ${themeProps.className}`}
        style={themeProps.style}
        onClick={handleCardClick}
      >
        <div className="post-card-sticker-area">
          <PostStickers stickers={stickers} layer="back" />

          <PostHeader
            pubkey={event.pubkey}
            createdAt={event.created_at}
            displayName={getDisplayName(profile, event.pubkey)}
            avatarUrl={getAvatarUrl(profile)}
            isProfileLoading={!profile}
            emojis={profile?.emojis}
            eventKind={event.kind}
            clickable={false}
          />

          <div className="post-content">
            <PostContent
              content={event.content}
              truncate
              emojis={parseEmojiTags(event.tags)}
              profiles={profile ? { [event.pubkey]: profile } : {}}
              tags={event.tags}
            />
          </div>

          <PostStickers stickers={stickers} layer="front" />
        </div>
      </article>
    </div>
  )
}
