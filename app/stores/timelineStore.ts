import { create } from 'zustand'
import type { Event } from 'nostr-tools'
import { fetchEvents, fetchReactions, fetchReplies, fetchReposts, fetchRepostEvents, publishEvent } from '../lib/nostr/relay'
import { getCurrentPubkey, createDeleteEvent, createTextNote, createReactionEvent, createRepostEvent, MYPACE_TAG } from '../lib/nostr/events'
import type { TimelineItem, ReactionCache, ReplyCache, RepostCache, FilterMode } from '../types'

interface TimelineState {
  timelineItems: TimelineItem[]
  events: Event[]
  reactions: ReactionCache
  replies: ReplyCache
  reposts: RepostCache
  myPubkey: string | null
  loading: boolean
  error: string

  // Filter state
  filterTags: string[]
  filterMode: FilterMode

  // UI state
  editingId: string | null
  editContent: string
  confirmDeleteId: string | null
  likingId: string | null
  repostingId: string | null
  expandedThreads: Set<string>
  copiedId: string | null
  filterCopied: boolean

  // Actions
  loadTimeline: () => Promise<void>
  setFilterTags: (tags: string[]) => void
  setFilterMode: (mode: FilterMode) => void
  handleLike: (event: Event) => Promise<void>
  handleRepost: (event: Event) => Promise<void>
  handleDelete: (event: Event) => Promise<void>
  handleEdit: (eventId: string, newContent: string) => Promise<void>
  toggleThread: (eventId: string) => void
  setEditingId: (id: string | null) => void
  setEditContent: (content: string) => void
  setConfirmDeleteId: (id: string | null) => void
  setCopiedId: (id: string | null) => void
  setFilterCopied: (copied: boolean) => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  timelineItems: [],
  events: [],
  reactions: {},
  replies: {},
  reposts: {},
  myPubkey: null,
  loading: true,
  error: '',

  filterTags: [],
  filterMode: 'and',

  editingId: null,
  editContent: '',
  confirmDeleteId: null,
  likingId: null,
  repostingId: null,
  expandedThreads: new Set(),
  copiedId: null,
  filterCopied: false,

  loadTimeline: async () => {
    set({ loading: true, error: '' })

    try {
      const pubkey = await getCurrentPubkey()
      set({ myPubkey: pubkey })

      let notes: Event[] = []
      const res = await fetch('/api/timeline?limit=50')
      if (res.ok) {
        const data = await res.json() as { events: Event[] }
        notes = data.events
      } else {
        notes = await fetchEvents({ kinds: [1] }, 50)
      }

      const initialItems: TimelineItem[] = notes.map(note => ({ event: note }))
      initialItems.sort((a, b) => b.event.created_at - a.event.created_at)

      set({ timelineItems: initialItems, events: notes, loading: false })

      // Load reactions, replies, reposts in background
      const eventIds = notes.map(e => e.id)

      fetchReactions(eventIds).then(reactionEvents => {
        const reactionMap: ReactionCache = {}
        for (const eventId of eventIds) {
          const eventReactions = reactionEvents.filter(r => {
            const eTag = r.tags.find(t => t[0] === 'e')
            return eTag && eTag[1] === eventId && (r.content === '+' || r.content === '')
          })
          reactionMap[eventId] = {
            count: eventReactions.length,
            myReaction: eventReactions.some(r => r.pubkey === pubkey)
          }
        }
        set({ reactions: reactionMap })
      })

      fetchReplies(eventIds).then(replyEvents => {
        const replyMap: ReplyCache = {}
        for (const eventId of eventIds) {
          const eventReplies = replyEvents.filter(r => {
            const rootTag = r.tags.find(t => t[0] === 'e' && t[3] === 'root')
            return rootTag && rootTag[1] === eventId
          })
          replyMap[eventId] = {
            count: eventReplies.length,
            replies: eventReplies
          }
        }
        set({ replies: replyMap })
      })

      fetchReposts(eventIds).then(repostEvents => {
        const repostMap: RepostCache = {}
        for (const eventId of eventIds) {
          const eventReposts = repostEvents.filter(r => {
            const eTag = r.tags.find(t => t[0] === 'e')
            return eTag && eTag[1] === eventId
          })
          repostMap[eventId] = {
            count: eventReposts.length,
            myRepost: eventReposts.some(r => r.pubkey === pubkey)
          }
        }
        set({ reposts: repostMap })
      })

      // Fetch reposts and merge
      fetchRepostEvents(50).then(repostEvents => {
        const items: TimelineItem[] = [...get().timelineItems]
        const allOriginalEvents: Event[] = [...notes]

        for (const repost of repostEvents) {
          try {
            if (!repost.content || repost.content.trim() === '') continue
            const originalEvent = JSON.parse(repost.content) as Event
            const hasMypaceTag = originalEvent.tags?.some(
              t => t[0] === 't' && t[1] === MYPACE_TAG
            )
            if (hasMypaceTag) {
              items.push({
                event: originalEvent,
                repostedBy: { pubkey: repost.pubkey, timestamp: repost.created_at }
              })
              if (!allOriginalEvents.some(e => e.id === originalEvent.id)) {
                allOriginalEvents.push(originalEvent)
              }
            }
          } catch {}
        }

        items.sort((a, b) => {
          const aTime = a.repostedBy?.timestamp || a.event.created_at
          const bTime = b.repostedBy?.timestamp || b.event.created_at
          return bTime - aTime
        })

        set({ timelineItems: items, events: allOriginalEvents })
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load timeline', loading: false })
    }
  },

  setFilterTags: (tags) => set({ filterTags: tags }),
  setFilterMode: (mode) => set({ filterMode: mode }),

  handleLike: async (event) => {
    const { likingId, myPubkey, reactions } = get()
    if (likingId || !myPubkey) return
    if (reactions[event.id]?.myReaction) return

    set({ likingId: event.id })
    try {
      const reactionEvent = await createReactionEvent(event, '+')
      await publishEvent(reactionEvent)

      set(state => ({
        reactions: {
          ...state.reactions,
          [event.id]: {
            count: (state.reactions[event.id]?.count || 0) + 1,
            myReaction: true
          }
        }
      }))
    } catch (err) {
      console.error('Failed to like:', err)
    } finally {
      set({ likingId: null })
    }
  },

  handleRepost: async (event) => {
    const { repostingId, myPubkey, reposts } = get()
    if (repostingId || !myPubkey) return
    if (reposts[event.id]?.myRepost) return

    set({ repostingId: event.id })
    try {
      const repostEvent = await createRepostEvent(event)
      await publishEvent(repostEvent)

      set(state => ({
        reposts: {
          ...state.reposts,
          [event.id]: {
            count: (state.reposts[event.id]?.count || 0) + 1,
            myRepost: true
          }
        }
      }))
    } catch (err) {
      console.error('Failed to repost:', err)
    } finally {
      set({ repostingId: null })
    }
  },

  handleDelete: async (event) => {
    try {
      const deleteEvent = await createDeleteEvent([event.id])
      await publishEvent(deleteEvent)
      set({ confirmDeleteId: null, editingId: null })
      setTimeout(() => get().loadTimeline(), 1000)
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  },

  handleEdit: async (eventId, newContent) => {
    if (!newContent.trim()) return

    const event = get().events.find(e => e.id === eventId)
    if (!event) return

    try {
      const deleteEvent = await createDeleteEvent([eventId])
      await publishEvent(deleteEvent)

      const newEvent = await createTextNote(newContent.trim())
      await publishEvent(newEvent)

      set({ editingId: null, editContent: '' })
      setTimeout(() => get().loadTimeline(), 1000)
    } catch (err) {
      console.error('Failed to edit:', err)
    }
  },

  toggleThread: (eventId) => {
    set(state => {
      const next = new Set(state.expandedThreads)
      if (next.has(eventId)) {
        next.delete(eventId)
      } else {
        next.add(eventId)
      }
      return { expandedThreads: next }
    })
  },

  setEditingId: (id) => set({ editingId: id }),
  setEditContent: (content) => set({ editContent: content }),
  setConfirmDeleteId: (id) => set({ confirmDeleteId: id }),
  setCopiedId: (id) => set({ copiedId: id }),
  setFilterCopied: (copied) => set({ filterCopied: copied })
}))
