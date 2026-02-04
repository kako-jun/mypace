import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { nip19 } from 'nostr-tools'
import { fetchMagazineBySlug, fetchEventsByIds, fetchUserProfile, publishEvent } from '../../lib/nostr/relay'
import { createMagazineEvent, formatTimestamp, type MagazineInput } from '../../lib/nostr/events'
import { getDisplayName, navigateToHome, navigateTo, navigateToPost, copyToClipboard } from '../../lib/utils'
import { getSnsIntentUrl } from '../../lib/utils/sns-share'
import { BackButton, Loading, Icon, Button, Avatar } from '../ui'
import { MagazineEditor } from './MagazineEditor'
import type { Magazine, Event, Profile } from '../../types'
import '../../styles/components/magazine.css'

function decodePubkey(id: string): string {
  try {
    if (id.startsWith('npub1')) {
      const decoded = nip19.decode(id)
      if (decoded.type === 'npub') {
        return decoded.data as string
      }
    }
  } catch {}
  return id
}

export function MagazineView() {
  const { npub, slug } = useParams<{ npub: string; slug: string }>()
  const pubkey = npub ? decodePubkey(npub) : ''

  const [magazine, setMagazine] = useState<Magazine | null>(null)
  const [posts, setPosts] = useState<Event[]>([])
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEditor, setShowEditor] = useState(false)
  const [myPubkey, setMyPubkey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showShareMenu, setShowShareMenu] = useState(false)

  const loadMagazine = useCallback(async () => {
    if (!pubkey || !slug) return

    setLoading(true)
    try {
      const [mag, profile] = await Promise.all([fetchMagazineBySlug(pubkey, slug), fetchUserProfile(pubkey)])

      setMagazine(mag)
      setAuthorProfile(profile)

      if (mag && mag.eventIds.length > 0) {
        const eventsMap = await fetchEventsByIds(mag.eventIds)
        // Preserve order from magazine.eventIds
        const orderedPosts = mag.eventIds.map((id) => eventsMap[id]).filter((e): e is Event => !!e)
        setPosts(orderedPosts)
      } else {
        setPosts([])
      }
    } catch (err) {
      console.error('Failed to load magazine:', err)
    } finally {
      setLoading(false)
    }
  }, [pubkey, slug])

  useEffect(() => {
    loadMagazine()
  }, [loadMagazine])

  // Record view when magazine is loaded
  useEffect(() => {
    if (!magazine || !pubkey || !slug) return

    const recordView = async () => {
      try {
        const viewerPubkey = await import('../../lib/nostr/events')
          .then(({ getCurrentPubkey }) => getCurrentPubkey())
          .catch(() => null)

        await fetch(`${import.meta.env.VITE_API_URL || ''}/api/magazine/views`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey,
            slug,
            viewerPubkey: viewerPubkey || '',
          }),
        })
      } catch {
        // Silently fail - view recording is not critical
      }
    }

    recordView()
  }, [magazine, pubkey, slug])

  useEffect(() => {
    // Get current user pubkey
    import('../../lib/nostr/events').then(({ getCurrentPubkey }) => {
      getCurrentPubkey()
        .then(setMyPubkey)
        .catch(() => {})
    })
  }, [])

  const handleBack = () => navigateToHome()
  const handleAuthorClick = () => navigateTo(`/user/${npub}`)

  const isOwner = myPubkey === pubkey

  const handleUpdateMagazine = async (input: MagazineInput) => {
    try {
      const event = await createMagazineEvent(input)
      await publishEvent(event)
      setShowEditor(false)
      await loadMagazine()
    } catch (err) {
      console.error('Failed to update magazine:', err)
    }
  }

  const handleRemovePost = async (eventId: string) => {
    if (!magazine) return

    const newEventIds = magazine.eventIds.filter((id) => id !== eventId)
    try {
      const event = await createMagazineEvent({
        slug: magazine.slug,
        title: magazine.title,
        description: magazine.description,
        image: magazine.image,
        eventIds: newEventIds,
      })
      await publishEvent(event)
      await loadMagazine()
    } catch (err) {
      console.error('Failed to remove post:', err)
    }
  }

  const handleMovePost = async (eventId: string, direction: 'up' | 'down') => {
    if (!magazine) return

    const index = magazine.eventIds.indexOf(eventId)
    if (index === -1) return

    const newEventIds = [...magazine.eventIds]
    const newIndex = direction === 'up' ? index - 1 : index + 1

    if (newIndex < 0 || newIndex >= newEventIds.length) return // Swap
    ;[newEventIds[index], newEventIds[newIndex]] = [newEventIds[newIndex], newEventIds[index]]

    try {
      const event = await createMagazineEvent({
        slug: magazine.slug,
        title: magazine.title,
        description: magazine.description,
        image: magazine.image,
        eventIds: newEventIds,
      })
      await publishEvent(event)
      await loadMagazine()
    } catch (err) {
      console.error('Failed to reorder posts:', err)
    }
  }

  const shareUrl = `${window.location.origin}/user/${npub}/magazine/${slug}`

  const handleCopyUrl = async () => {
    const success = await copyToClipboard(shareUrl)
    if (success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
    setShowShareMenu(false)
  }

  const handleWebShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: magazine?.title || 'Magazine',
          url: shareUrl,
        })
      } catch {
        // User cancelled or error
      }
    }
    setShowShareMenu(false)
  }

  const handleSnsShare = (sns: 'x' | 'bluesky' | 'threads') => {
    const text = `📚 ${magazine?.title || 'Magazine'} by @${getDisplayName(authorProfile, pubkey)}\n${shareUrl}`
    const intentUrl = getSnsIntentUrl(sns, text)
    window.open(intentUrl, '_blank', 'noopener,noreferrer')
    setShowShareMenu(false)
  }

  if (loading) {
    return <Loading />
  }

  if (!magazine) {
    return (
      <div className="magazine-view">
        <BackButton onClick={handleBack} />
        <div className="magazine-view-header">
          <p>Magazine not found</p>
          <Button size="md" onClick={handleBack}>
            Back to Timeline
          </Button>
        </div>
      </div>
    )
  }

  const authorName = getDisplayName(authorProfile, pubkey)

  return (
    <div className="magazine-view">
      <BackButton onClick={handleBack} />

      <div className="magazine-view-header">
        <div className="magazine-view-image">
          {magazine.image ? (
            <img src={magazine.image} alt={magazine.title} />
          ) : (
            <div className="magazine-view-image-placeholder">
              <Icon name="BookOpen" size={48} />
            </div>
          )}
        </div>

        <h1 className="magazine-view-title">{magazine.title || 'Untitled'}</h1>

        <div className="magazine-view-author">
          by{' '}
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              handleAuthorClick()
            }}
          >
            @{authorName}
          </a>
        </div>

        {magazine.description && <p className="magazine-view-description">{magazine.description}</p>}

        <div className="magazine-view-actions">
          <div className="magazine-share-wrapper">
            <Button size="sm" variant="secondary" onClick={() => setShowShareMenu(!showShareMenu)}>
              <Icon name={copied ? 'Check' : 'Share2'} size={14} /> {copied ? 'Copied!' : 'Share'}
            </Button>
            {showShareMenu && (
              <div className="magazine-share-menu">
                <button className="magazine-share-option" onClick={handleCopyUrl}>
                  <Icon name="Link" size={14} /> Copy URL
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button className="magazine-share-option" onClick={handleWebShare}>
                    <Icon name="Share2" size={14} /> Share to Apps
                  </button>
                )}
                <div className="magazine-share-divider" />
                <button className="magazine-share-option" onClick={() => handleSnsShare('x')}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X
                </button>
                <button className="magazine-share-option" onClick={() => handleSnsShare('bluesky')}>
                  <Icon name="Cloud" size={14} /> Bluesky
                </button>
                <button className="magazine-share-option" onClick={() => handleSnsShare('threads')}>
                  <Icon name="AtSign" size={14} /> Threads
                </button>
              </div>
            )}
          </div>
          {isOwner && (
            <Button size="sm" variant="secondary" onClick={() => setShowEditor(true)}>
              <Icon name="Edit2" size={14} /> Edit
            </Button>
          )}
        </div>
      </div>

      <div className="magazine-view-posts">
        <div className="magazine-view-posts-header">
          <Icon name="FileText" size={14} /> {posts.length} posts
        </div>

        {posts.length === 0 ? (
          <div className="magazine-view-empty">No posts in this magazine yet</div>
        ) : (
          posts.map((post, index) => (
            <div key={post.id} className="magazine-post-item">
              {isOwner && (
                <div className="magazine-post-controls">
                  <button
                    className="magazine-post-control-btn"
                    onClick={() => handleMovePost(post.id, 'up')}
                    disabled={index === 0}
                    title="Move up"
                  >
                    <Icon name="ChevronUp" size={14} />
                  </button>
                  <button
                    className="magazine-post-control-btn"
                    onClick={() => handleMovePost(post.id, 'down')}
                    disabled={index === posts.length - 1}
                    title="Move down"
                  >
                    <Icon name="ChevronDown" size={14} />
                  </button>
                  <button
                    className="magazine-post-control-btn delete"
                    onClick={() => handleRemovePost(post.id)}
                    title="Remove from magazine"
                  >
                    <Icon name="X" size={14} />
                  </button>
                </div>
              )}
              <button className="magazine-post-card" onClick={() => navigateToPost(post.id)} type="button">
                <div className="magazine-post-card-header">
                  <Avatar src={authorProfile?.picture} size="small" />
                  <div className="magazine-post-card-meta">
                    <span className="magazine-post-card-author">{authorName}</span>
                    <span className="magazine-post-card-time">{formatTimestamp(post.created_at)}</span>
                  </div>
                </div>
                <div className="magazine-post-card-content">
                  {post.content.length > 200 ? `${post.content.slice(0, 200)}...` : post.content}
                </div>
              </button>
            </div>
          ))
        )}
      </div>

      {showEditor && (
        <MagazineEditor magazine={magazine} onSave={handleUpdateMagazine} onClose={() => setShowEditor(false)} />
      )}
    </div>
  )
}
