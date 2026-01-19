import { useState, useRef, useCallback } from 'react'
import { publishEvent } from '../../lib/nostr/relay'
import { createDeleteEvent, createReactionEvent, MAX_STELLA_PER_USER } from '../../lib/nostr/events'
import type { Event, ReactionData } from '../../types'

interface UseReactionsOptions {
  event: Event | null
  myPubkey: string | null
  initialReactions: ReactionData
}

export function useReactions({ event, myPubkey, initialReactions }: UseReactionsOptions) {
  const [reactions, setReactions] = useState<ReactionData>(initialReactions)
  const [likingId, setLikingId] = useState<string | null>(null)

  const stellaDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStella = useRef(0)

  const flushStella = useCallback(async () => {
    if (!event) return
    const stellaToSend = pendingStella.current
    if (stellaToSend <= 0) return

    pendingStella.current = 0

    const previousReactions = { ...reactions }
    const oldReactionId = reactions.myReactionId
    const currentMyStella = reactions.myStella

    setLikingId(event.id)
    try {
      const newTotalStella = Math.min(currentMyStella + stellaToSend, MAX_STELLA_PER_USER)

      const newReaction = await createReactionEvent(event, '+', newTotalStella)
      await publishEvent(newReaction)

      if (oldReactionId) {
        try {
          await publishEvent(await createDeleteEvent([oldReactionId]))
        } catch {
          // Ignore delete errors
        }
      }

      setReactions((prev) => {
        const myIndex = prev.reactors.findIndex((r) => r.pubkey === myPubkey)
        const updatedReactors =
          myIndex >= 0
            ? prev.reactors.map((r, i) =>
                i === myIndex
                  ? { ...r, stella: newTotalStella, reactionId: newReaction.id, createdAt: newReaction.created_at }
                  : r
              )
            : [
                {
                  pubkey: myPubkey!,
                  stella: newTotalStella,
                  stellaColor: 'yellow' as const,
                  reactionId: newReaction.id,
                  createdAt: newReaction.created_at,
                },
                ...prev.reactors,
              ]

        return {
          count: prev.count - currentMyStella + newTotalStella,
          myReaction: true,
          myStella: newTotalStella,
          myStellaColor: prev.myStellaColor,
          myReactionId: newReaction.id,
          reactors: updatedReactors,
        }
      })
    } catch (error) {
      console.error('Failed to publish reaction:', error)
      setReactions(previousReactions)
    } finally {
      setLikingId(null)
    }
  }, [event, myPubkey, reactions])

  const handleLike = useCallback(() => {
    if (!event || !myPubkey || event.pubkey === myPubkey) return

    const currentMyStella = reactions.myStella
    const pending = pendingStella.current

    if (currentMyStella + pending >= MAX_STELLA_PER_USER) return

    pendingStella.current = pending + 1

    setReactions((prev) => ({
      count: prev.count + 1,
      myReaction: true,
      myStella: currentMyStella + pending + 1,
      myStellaColor: prev.myStellaColor,
      myReactionId: prev.myReactionId,
      reactors: prev.reactors,
    }))

    if (stellaDebounceTimer.current) {
      clearTimeout(stellaDebounceTimer.current)
    }
    stellaDebounceTimer.current = setTimeout(() => {
      flushStella()
    }, 300)
  }, [event, myPubkey, reactions.myStella, flushStella])

  const handleUnlike = useCallback(async () => {
    if (!event || !myPubkey || !reactions.myReactionId) return

    if (stellaDebounceTimer.current) {
      clearTimeout(stellaDebounceTimer.current)
      stellaDebounceTimer.current = null
    }
    pendingStella.current = 0

    setLikingId(event.id)
    try {
      await publishEvent(await createDeleteEvent([reactions.myReactionId]))

      setReactions((prev) => ({
        count: Math.max(0, prev.count - prev.myStella),
        myReaction: false,
        myStella: 0,
        myStellaColor: 'yellow',
        myReactionId: null,
        reactors: prev.reactors.filter((r) => r.pubkey !== myPubkey),
      }))
    } finally {
      setLikingId(null)
    }
  }, [event, myPubkey, reactions.myReactionId])

  return {
    reactions,
    setReactions,
    likingId,
    handleLike,
    handleUnlike,
  }
}
