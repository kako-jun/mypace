import { useState, useRef, useCallback } from 'react'
import { publishEvent } from '../../lib/nostr/relay'
import {
  createDeleteEvent,
  createReactionEvent,
  MAX_STELLA_PER_USER,
  EMPTY_STELLA_COUNTS,
  getTotalStellaCount,
  type StellaColor,
  type StellaCountsByColor,
} from '../../lib/nostr/events'
import { sendToLightningAddress, getStellaCostDiff } from '../../lib/lightning'
import type { Event, ReactionData } from '../../types'

interface UseReactionsOptions {
  event: Event | null
  myPubkey: string | null
  initialReactions: ReactionData
  authorLud16?: string | null
}

export function useReactions({ event, myPubkey, initialReactions, authorLud16 }: UseReactionsOptions) {
  const [reactions, setReactions] = useState<ReactionData>(initialReactions)
  const [likingId, setLikingId] = useState<string | null>(null)

  const stellaDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingStella = useRef<StellaCountsByColor>({ ...EMPTY_STELLA_COUNTS })

  const flushStella = useCallback(async () => {
    if (!event) return
    const pending = pendingStella.current
    const totalPending = getTotalStellaCount(pending)
    if (totalPending <= 0) return

    // Reset pending immediately
    const stellaToSend = { ...pending }
    pendingStella.current = { ...EMPTY_STELLA_COUNTS }

    const previousReactions = { ...reactions }
    const oldReactionId = reactions.myReactionId
    const currentMyStella = reactions.myStella

    // Calculate new total stella counts
    const newMyStella: StellaCountsByColor = {
      yellow: Math.min(currentMyStella.yellow + stellaToSend.yellow, MAX_STELLA_PER_USER),
      green: Math.min(currentMyStella.green + stellaToSend.green, MAX_STELLA_PER_USER),
      red: Math.min(currentMyStella.red + stellaToSend.red, MAX_STELLA_PER_USER),
      blue: Math.min(currentMyStella.blue + stellaToSend.blue, MAX_STELLA_PER_USER),
      purple: Math.min(currentMyStella.purple + stellaToSend.purple, MAX_STELLA_PER_USER),
    }

    // カラーステラの場合は支払い処理
    const cost = getStellaCostDiff(currentMyStella, newMyStella)
    if (cost > 0) {
      if (!authorLud16) {
        console.warn('Author has no lightning address, cannot send colored stella')
        setReactions(previousReactions)
        return
      }

      setLikingId(event.id)
      const payResult = await sendToLightningAddress(authorLud16, cost)
      if (!payResult.success) {
        console.error('Payment failed:', payResult.error)
        setLikingId(null)
        setReactions(previousReactions)
        return
      }
      // 支払い成功、続けてステラを送信
    } else {
      setLikingId(event.id)
    }

    try {
      const newReaction = await createReactionEvent(event, '+', newMyStella)
      await publishEvent(newReaction)

      if (oldReactionId) {
        try {
          await publishEvent(await createDeleteEvent([oldReactionId]))
        } catch {
          // Ignore delete errors
        }
      }

      const currentMyTotal = getTotalStellaCount(currentMyStella)
      const newMyTotal = getTotalStellaCount(newMyStella)

      setReactions((prev) => {
        const myIndex = prev.reactors.findIndex((r) => r.pubkey === myPubkey)
        const updatedReactors =
          myIndex >= 0
            ? prev.reactors.map((r, i) =>
                i === myIndex
                  ? {
                      ...r,
                      stella: newMyStella,
                      reactionId: newReaction.id,
                      createdAt: newReaction.created_at,
                    }
                  : r
              )
            : [
                {
                  pubkey: myPubkey!,
                  stella: newMyStella,
                  reactionId: newReaction.id,
                  createdAt: newReaction.created_at,
                },
                ...prev.reactors,
              ]

        return {
          totalCount: prev.totalCount - currentMyTotal + newMyTotal,
          myReaction: true,
          myStella: newMyStella,
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
  }, [event, myPubkey, reactions, authorLud16])

  const handleAddStella = useCallback(
    (color: StellaColor) => {
      if (!event || !myPubkey || event.pubkey === myPubkey) return

      const currentMyTotal = getTotalStellaCount(reactions.myStella)
      const pendingTotal = getTotalStellaCount(pendingStella.current)

      if (currentMyTotal + pendingTotal >= MAX_STELLA_PER_USER) return

      // Add to pending for this color
      pendingStella.current = {
        ...pendingStella.current,
        [color]: pendingStella.current[color] + 1,
      }

      // Optimistic UI update
      setReactions((prev) => ({
        totalCount: prev.totalCount + 1,
        myReaction: true,
        myStella: {
          ...prev.myStella,
          [color]: prev.myStella[color] + 1,
        },
        myReactionId: prev.myReactionId,
        reactors: prev.reactors,
      }))

      if (stellaDebounceTimer.current) {
        clearTimeout(stellaDebounceTimer.current)
      }
      stellaDebounceTimer.current = setTimeout(() => {
        flushStella()
      }, 500)
    },
    [event, myPubkey, reactions.myStella, flushStella]
  )

  const handleUnlike = useCallback(async () => {
    if (!event || !myPubkey || !reactions.myReactionId) return

    // カラーステラは取り消し不可（支払い済みのため）
    const hasColoredStella =
      reactions.myStella.green > 0 ||
      reactions.myStella.red > 0 ||
      reactions.myStella.blue > 0 ||
      reactions.myStella.purple > 0
    if (hasColoredStella) {
      return
    }

    if (stellaDebounceTimer.current) {
      clearTimeout(stellaDebounceTimer.current)
      stellaDebounceTimer.current = null
    }
    pendingStella.current = { ...EMPTY_STELLA_COUNTS }

    const currentMyTotal = getTotalStellaCount(reactions.myStella)

    setLikingId(event.id)
    try {
      await publishEvent(await createDeleteEvent([reactions.myReactionId]))

      setReactions((prev) => ({
        totalCount: Math.max(0, prev.totalCount - currentMyTotal),
        myReaction: false,
        myStella: { ...EMPTY_STELLA_COUNTS },
        myReactionId: null,
        reactors: prev.reactors.filter((r) => r.pubkey !== myPubkey),
      }))
    } finally {
      setLikingId(null)
    }
  }, [event, myPubkey, reactions.myReactionId, reactions.myStella])

  return {
    reactions,
    setReactions,
    likingId,
    handleAddStella,
    handleUnlike,
  }
}
