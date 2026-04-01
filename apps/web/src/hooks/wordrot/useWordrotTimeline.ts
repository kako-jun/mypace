import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { extractNounsBatch, collectWord, fetchWordrotInventory } from '../../lib/api/api'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { useWordCelebration } from '../../components/wordrot/WordCollectCelebration'

interface PostData {
  eventId: string
  content: string
}

interface WordsCache {
  [eventId: string]: string[]
}

interface WordImageCache {
  [word: string]: string | null // word text -> image URL or null
}

/**
 * Hook for managing wordrot functionality on the timeline
 * Handles batch extraction, caching, and collection
 */
export function useWordrotTimeline() {
  const [wordsCache, setWordsCache] = useState<WordsCache>({})
  const [collectedWords, setCollectedWords] = useState<Set<string>>(new Set())
  const [wordImages, setWordImages] = useState<WordImageCache>({})
  const [isExtracting, setIsExtracting] = useState(false)
  const [pubkey, setPubkey] = useState<string | null>(null)

  // Track pending extraction requests to avoid duplicates
  const pendingExtraction = useRef<Set<string>>(new Set())

  // Get celebration context (always available since WordrotProvider is inside WordCelebrationProvider)
  const { celebrate } = useWordCelebration()

  // Refresh inventory from API (reusable for mount and visibility change)
  const refreshInventory = useCallback(async (pk: string) => {
    try {
      const inventory = await fetchWordrotInventory(pk)
      const collected = new Set<string>(inventory.words.map((w) => w.word.text.toLowerCase()))
      setCollectedWords(collected)

      const images: WordImageCache = {}
      for (const item of inventory.words) {
        const wordText = item.word.text
        if (images[wordText]) continue
        const imageUrl = item.word.image_url
        if (imageUrl) {
          images[wordText] = imageUrl
        }
      }
      setWordImages(images)
    } catch {
      // silently fail
    }
  }, [])

  // Load current user's pubkey and collected words on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const pk = await getCurrentPubkey()
        setPubkey(pk)
        await refreshInventory(pk)
      } catch {
        // User not logged in or error - silently fail
      }
    }

    loadUserData()
  }, [refreshInventory])

  // Refresh inventory when tab regains focus or navigating back from PostView
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && pubkey) {
        refreshInventory(pubkey)
      }
    }
    const handleWordrotRefresh = () => {
      if (pubkey) refreshInventory(pubkey)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('wordrot-inventory-changed', handleWordrotRefresh)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('wordrot-inventory-changed', handleWordrotRefresh)
    }
  }, [pubkey, refreshInventory])

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
        // API limits to 50 posts per batch, so split into chunks
        const BATCH_SIZE = 50
        for (let i = 0; i < uncachedPosts.length; i += BATCH_SIZE) {
          const chunk = uncachedPosts.slice(i, i + BATCH_SIZE)
          const result = await extractNounsBatch(chunk)

          // Update cache
          setWordsCache((prev) => {
            const updated = { ...prev }
            for (const [eventId, data] of Object.entries(result.results)) {
              updated[eventId] = data.words
            }
            return updated
          })
        }
      } catch (err) {
        console.error('[Wordrot] Failed to extract words:', err)
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
      if (!pubkey) {
        return false
      }

      try {
        const result = await collectWord(pubkey, word, eventId)

        if (result.word) {
          // Update collected words set (lowercase for case-insensitive comparison)
          setCollectedWords((prev) => new Set([...prev, word.toLowerCase()]))

          // Update image cache if word has an image
          const imageUrl = result.word.image_url
          if (imageUrl) {
            setWordImages((prev) => ({ ...prev, [word]: imageUrl }))
          }

          // Trigger celebration
          if (celebrate) {
            celebrate({
              word: result.word,
              isNew: result.isNew,
              isFirstEver: result.isFirstEver,
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

  /**
   * Get image URL for a word (if available)
   */
  const getWordImage = useCallback(
    (word: string): string | null => {
      return wordImages[word] || null
    },
    [wordImages]
  )

  // Memoize context value to prevent unnecessary re-renders of consumers
  return useMemo(
    () => ({
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

      // Images
      wordImages,
      getWordImage,

      // User state
      isLoggedIn: !!pubkey,
    }),
    [
      getWords,
      hasWords,
      wordsCache,
      extractWords,
      isExtracting,
      collect,
      collectedWords,
      isCollected,
      wordImages,
      getWordImage,
      pubkey,
    ]
  )
}
