import { useState, useCallback, useRef, useEffect } from 'react'
import { extractNounsBatch, collectWord, fetchWordrotInventory } from '../../lib/api/api'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { useWordCelebration, type WordCollectResult } from '../../components/wordrot/WordCollectCelebration'

interface PostData {
  eventId: string
  content: string
}

interface WordsCache {
  [eventId: string]: string[]
}

/**
 * Hook for managing wordrot functionality on the timeline
 * Handles batch extraction, caching, and collection
 */
export function useWordrotTimeline() {
  const [wordsCache, setWordsCache] = useState<WordsCache>({})
  const [collectedWords, setCollectedWords] = useState<Set<string>>(new Set())
  const [isExtracting, setIsExtracting] = useState(false)
  const [pubkey, setPubkey] = useState<string | null>(null)

  // Track pending extraction requests to avoid duplicates
  const pendingExtraction = useRef<Set<string>>(new Set())

  // Get celebration context
  let celebrate: ((result: WordCollectResult) => void) | null = null
  try {
    const celebrationContext = useWordCelebration()
    celebrate = celebrationContext.celebrate
  } catch {
    // Context not available - celebration won't show
  }

  // Load current user's pubkey and collected words on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const pk = await getCurrentPubkey()
        setPubkey(pk)

        // Load user's inventory to know which words are already collected
        const inventory = await fetchWordrotInventory(pk)
        const collected = new Set<string>(inventory.words.map((w) => w.word.text))
        setCollectedWords(collected)
      } catch {
        // User not logged in or error - silently fail
      }
    }

    loadUserData()
  }, [])

  /**
   * Get cached words for an event ID
   */
  const getWords = useCallback(
    (eventId: string): string[] | undefined => {
      return wordsCache[eventId]
    },
    [wordsCache]
  )

  /**
   * Check if words have been extracted for an event
   */
  const hasWords = useCallback(
    (eventId: string): boolean => {
      return eventId in wordsCache
    },
    [wordsCache]
  )

  /**
   * Extract words from multiple posts (batch)
   * Filters out already-cached and pending events
   */
  const extractWords = useCallback(
    async (posts: PostData[]): Promise<void> => {
      // Filter out already cached and pending events
      const uncachedPosts = posts.filter((p) => !(p.eventId in wordsCache) && !pendingExtraction.current.has(p.eventId))

      if (uncachedPosts.length === 0) return

      // Mark as pending
      uncachedPosts.forEach((p) => pendingExtraction.current.add(p.eventId))
      setIsExtracting(true)

      try {
        // Batch extract
        const result = await extractNounsBatch(uncachedPosts)

        // Update cache
        setWordsCache((prev) => {
          const updated = { ...prev }
          for (const [eventId, data] of Object.entries(result.results)) {
            updated[eventId] = data.words
          }
          return updated
        })
      } catch {
        // Error extracting - silently fail
      } finally {
        // Clear pending
        uncachedPosts.forEach((p) => pendingExtraction.current.delete(p.eventId))
        setIsExtracting(false)
      }
    },
    [wordsCache]
  )

  /**
   * Collect a word from a post
   */
  const collect = useCallback(
    async (word: string, eventId?: string): Promise<boolean> => {
      if (!pubkey) return false

      try {
        const result = await collectWord(pubkey, word, eventId)

        if (result.word) {
          // Update collected words set
          setCollectedWords((prev) => new Set([...prev, word]))

          // Trigger celebration
          if (celebrate) {
            celebrate({
              word: result.word,
              isNew: result.isNew,
              isFirstEver: result.isFirstEver,
              count: result.count,
            })
          }

          return true
        }

        return false
      } catch {
        return false
      }
    },
    [pubkey, celebrate]
  )

  /**
   * Check if a word is already collected
   */
  const isCollected = useCallback(
    (word: string): boolean => {
      return collectedWords.has(word)
    },
    [collectedWords]
  )

  return {
    // Cache access
    getWords,
    hasWords,
    wordsCache,

    // Extraction
    extractWords,
    isExtracting,

    // Collection
    collect,
    collectedWords,
    isCollected,

    // User state
    isLoggedIn: !!pubkey,
  }
}
