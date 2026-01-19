import { useState, useRef, useCallback } from 'react'
import { publishEvent } from '../../lib/nostr/relay'
import { createDeleteEvent, createReactionEvent, MAX_STELLA_PER_USER, type StellaColor } from '../../lib/nostr/events'
import { sendToLightningAddress, getStellaCost } from '../../lib/lightning'
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
  const pendingStella = useRef<{ count: number; color: StellaColor }>({ count: 0, color: 'yellow' })

  const flushStella = useCallback(async () => {
    if (!event) return
    const pending = pendingStella.current
    if (pending.count <= 0) return

    const stellaToSend = pending.count
    const stellaColor = pending.color
    pendingStella.current = { count: 0, color: 'yellow' }

    const previousReactions = { ...reactions }
    const oldReactionId = reactions.myReactionId
    const currentMyStella = reactions.myStella

    // カラーステラの場合は支払い処理
    const cost = getStellaCost(stellaColor, stellaToSend)
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
      const newTotalStella = Math.min(currentMyStella + stellaToSend, MAX_STELLA_PER_USER)

      const newReaction = await createReactionEvent(event, '+', newTotalStella, stellaColor)
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
                  ? {
                      ...r,
                      stella: newTotalStella,
                      stellaColor,
                      reactionId: newReaction.id,
                      createdAt: newReaction.created_at,
                    }
                  : r
              )
            : [
                {
                  pubkey: myPubkey!,
                  stella: newTotalStella,
                  stellaColor,
                  reactionId: newReaction.id,
                  createdAt: newReaction.created_at,
                },
                ...prev.reactors,
              ]

        return {
          count: prev.count - currentMyStella + newTotalStella,
          myReaction: true,
          myStella: newTotalStella,
          myStellaColor: stellaColor,
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

  const handleLike = useCallback(
    (color: StellaColor = 'yellow') => {
      if (!event || !myPubkey || event.pubkey === myPubkey) return

      const currentMyStella = reactions.myStella
      const pending = pendingStella.current.count

      if (currentMyStella + pending >= MAX_STELLA_PER_USER) return

      // 既にステラがある場合は同じ色のみ追加可能
      if (currentMyStella > 0 && reactions.myStellaColor && reactions.myStellaColor !== color) {
        return
      }

      pendingStella.current = { count: pending + 1, color }

      setReactions((prev) => ({
        count: prev.count + 1,
        myReaction: true,
        myStella: currentMyStella + pending + 1,
        myStellaColor: color,
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
    [event, myPubkey, reactions.myStella, reactions.myStellaColor, flushStella]
  )

  const handleUnlike = useCallback(async () => {
    if (!event || !myPubkey || !reactions.myReactionId) return

    // カラーステラは取り消し不可（支払い済みのため）
    if (reactions.myStellaColor && reactions.myStellaColor !== 'yellow') {
      return
    }

    if (stellaDebounceTimer.current) {
      clearTimeout(stellaDebounceTimer.current)
      stellaDebounceTimer.current = null
    }
    pendingStella.current = { count: 0, color: 'yellow' }

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
  }, [event, myPubkey, reactions.myReactionId, reactions.myStellaColor])

  return {
    reactions,
    setReactions,
    likingId,
    handleLike,
    handleUnlike,
  }
}
