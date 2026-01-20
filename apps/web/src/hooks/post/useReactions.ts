import { useState, useRef, useCallback, useEffect } from 'react'
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
import { sendToLightningAddress } from '../../lib/lightning'
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

  // Sync with initialReactions only when reaction data is first loaded
  // (indicated by myReactionId changing from null to a value, or reactors being populated)
  const prevReactorsCount = useRef(initialReactions.reactors.length)
  useEffect(() => {
    // Only sync if:
    // 1. reactors count increased (new data loaded from API/cache)
    // 2. AND we haven't started any local modifications (likingId is null)
    if (initialReactions.reactors.length > prevReactorsCount.current && likingId === null) {
      setReactions(initialReactions)
    }
    prevReactorsCount.current = initialReactions.reactors.length
  }, [initialReactions, likingId])

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

    // 楽観的更新済みの現在値をそのまま使用（既にpending分が加算されている）
    const newMyStella: StellaCountsByColor = reactions.myStella

    // カラーステラの場合は支払い処理（stellaToSendから直接計算）
    const cost = stellaToSend.green * 1 + stellaToSend.red * 10 + stellaToSend.blue * 100 + stellaToSend.purple * 1000
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

    const myStella = reactions.myStella
    // イエローがなければ取り消す対象がない
    if (myStella.yellow <= 0) return

    if (stellaDebounceTimer.current) {
      clearTimeout(stellaDebounceTimer.current)
      stellaDebounceTimer.current = null
    }
    pendingStella.current = { ...EMPTY_STELLA_COUNTS }

    // イエローを0にして、カラーステラは残す
    const newMyStella: StellaCountsByColor = {
      yellow: 0,
      green: myStella.green,
      red: myStella.red,
      blue: myStella.blue,
      purple: myStella.purple,
    }
    const remainingTotal = getTotalStellaCount(newMyStella)

    setLikingId(event.id)
    try {
      if (remainingTotal > 0) {
        // カラーステラが残る場合は新しいリアクションを発行
        const newReaction = await createReactionEvent(event, '+', newMyStella)
        await publishEvent(newReaction)
        // 古いリアクションを削除
        try {
          await publishEvent(await createDeleteEvent([reactions.myReactionId]))
        } catch {
          // 削除失敗は無視
        }
        setReactions((prev) => {
          const updatedReactors = prev.reactors.map((r) =>
            r.pubkey === myPubkey
              ? { ...r, stella: newMyStella, reactionId: newReaction.id, createdAt: newReaction.created_at }
              : r
          )
          return {
            myReaction: true,
            myStella: newMyStella,
            myReactionId: newReaction.id,
            reactors: updatedReactors,
          }
        })
      } else {
        // 全てのステラを削除
        await publishEvent(await createDeleteEvent([reactions.myReactionId]))
        setReactions((prev) => ({
          myReaction: false,
          myStella: { ...EMPTY_STELLA_COUNTS },
          myReactionId: null,
          reactors: prev.reactors.filter((r) => r.pubkey !== myPubkey),
        }))
      }
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
