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

  // Load current user's pubkey and collected words on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const pk = await getCurrentPubkey()
        setPubkey(pk)

        // Load user's inventory to know which words are already collected
        const inventory = await fetchWordrotInventory(pk)
        const collected = new Set<string>(inventory.words.map((w) => w.word.text.toLowerCase()))
        setCollectedWords(collected)

        // Build image cache from inventory - use appropriate image based on source
        const images: WordImageCache = {}
        for (const item of inventory.words) {
          const wordText = item.word.text
          // Skip if already set (prefer first occurrence)
          if (images[wordText]) continue

          // Use appropriate image based on source
          const imageUrl = item.source === 'synthesis' ? item.word.image_url_synthesis : item.word.image_url
          if (imageUrl) {
            images[wordText] = imageUrl
          }
        }
        setWordImages(images)
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
        // API limits to 50 posts per batch, so split into chunks
        const BATCH_SIZE = 50
        for (let i = 0; i < uncachedPosts.length; i += BATCH_SIZE) {
          const chunk = uncachedPosts.slice(i, i + BATCH_SIZE)
          console.log(
            `[Wordrot] Extracting batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uncachedPosts.length / BATCH_SIZE)} (${chunk.length} posts)`
          )

          const result = await extractNounsBatch(chunk)
          console.log('[Wordrot] Extracted words:', result)

          // Update cache
          setWordsCache((prev) => {
            const updated = { ...prev }
            for (const [eventId, data] of Object.entries(result.results)) {
              updated[eventId] = data.words
              console.log(`[Wordrot] Cached ${data.words.length} words for event ${eventId.slice(0, 8)}`)
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
      console.log('[useWordrotTimeline] Collect called:', { word, eventId: eventId?.slice(0, 8), hasPubkey: !!pubkey })
      if (!pubkey) {
        console.log('[useWordrotTimeline] No pubkey, returning false')
        return false
      }

      try {
        console.log('[useWordrotTimeline] Calling collectWord API...')
        const result = await collectWord(pubkey, word, eventId)
        console.log('[useWordrotTimeline] collectWord result:', result)

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
