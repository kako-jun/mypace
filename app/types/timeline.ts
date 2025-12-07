import type { Event } from 'nostr-tools'
import type { Profile } from '../lib/nostr/events'

export interface ProfileCache {
  [pubkey: string]: Profile | null
}

export interface ReactionData {
  count: number
  myReaction: boolean
}

export interface ReplyData {
  count: number
  replies: Event[]
}

export interface RepostData {
  count: number
  myRepost: boolean
}

export interface TimelineItem {
  event: Event
  repostedBy?: { pubkey: string; timestamp: number }
}

export interface TimelineData {
  items: TimelineItem[]
  events: Event[]
  profiles: ProfileCache
  reactions: { [eventId: string]: ReactionData }
  replies: { [eventId: string]: ReplyData }
  reposts: { [eventId: string]: RepostData }
}
