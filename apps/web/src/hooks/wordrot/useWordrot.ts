import { useState, useCallback, useEffect } from 'react'
import {
  extractNouns,
  collectWord,
  fetchWordrotInventory,
  type WordrotWord,
  type UserWordrotWord,
} from '../../lib/api/api'
import { getStoredSecretKey, getPublicKeyFromSecret } from '../../lib/nostr/keys'

// Cache for extracted words per event
const extractedWordsCache = new Map<string, string[]>()

export interface UseWordrotReturn {
  // Extraction
  extractWords: (eventId: string, content: string) => Promise<string[]>
  getExtractedWords: (eventId: string) => string[] | undefined

  // Collection
  collect: (word: string, eventId?: string) => Promise<CollectResult | null>
  isCollecting: boolean

  // Inventory
  inventory: UserWordrotWord[]
  totalCount: number
  uniqueCount: number
  loadInventory: () => Promise<void>
  isLoadingInventory: boolean

  // Celebration
  celebrationWord: CollectResult | null
  clearCelebration: () => void
}

export interface CollectResult {
  word: WordrotWord
  isNew: boolean
  isFirstEver: boolean
  count: number
}

export function useWordrot(): UseWordrotReturn {
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [isCollecting, setIsCollecting] = useState(false)
  const [inventory, setInventory] = useState<UserWordrotWord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [uniqueCount, setUniqueCount] = useState(0)
  const [isLoadingInventory, setIsLoadingInventory] = useState(false)
  const [celebrationWord, setCelebrationWord] = useState<CollectResult | null>(null)

  // Get pubkey from stored secret key
  useEffect(() => {
    const sk = getStoredSecretKey()
    if (sk) {
      const pk = getPublicKeyFromSecret(sk)
      setPubkey(pk)
    }
  }, [])

  // Extract words from content
  const extractWords = useCallback(async (eventId: string, content: string): Promise<string[]> => {
    // Check cache first
    const cached = extractedWordsCache.get(eventId)
    if (cached) return cached

    const result = await extractNouns(eventId, content)
    const words = result.words

    // Cache result
    extractedWordsCache.set(eventId, words)

    return words
  }, [])

  // Get cached extracted words
  const getExtractedWords = useCallback((eventId: string): string[] | undefined => {
    return extractedWordsCache.get(eventId)
  }, [])

  // Load inventory
  const loadInventory = useCallback(async () => {
    if (!pubkey) return

    setIsLoadingInventory(true)
    try {
      const result = await fetchWordrotInventory(pubkey)
      setInventory(result.words)
      setTotalCount(result.totalCount)
      setUniqueCount(result.uniqueCount)
    } finally {
      setIsLoadingInventory(false)
    }
  }, [pubkey])

  // Collect a word
  const collect = useCallback(
    async (word: string, eventId?: string): Promise<CollectResult | null> => {
      if (!pubkey) return null

      setIsCollecting(true)
      try {
        const result = await collectWord(pubkey, word, eventId)

        if (result.word) {
          const collectResult: CollectResult = {
            word: result.word,
            isNew: result.isNew,
            isFirstEver: result.isFirstEver,
            count: result.count,
          }

          // Show celebration
          setCelebrationWord(collectResult)

          // collectWordレスポンスにinventoryが含まれている場合、直接stateを更新（再fetchを回避）
          if (result.inventory) {
            setInventory(result.inventory.words)
            setTotalCount(result.inventory.totalCount)
            setUniqueCount(result.inventory.uniqueCount)
          }

          return collectResult
        }

        return null
      } finally {
        setIsCollecting(false)
      }
    },
    [pubkey]
  )

  // Clear celebration
  const clearCelebration = useCallback(() => {
    setCelebrationWord(null)
  }, [])

  // Load inventory on mount if logged in
  useEffect(() => {
    if (pubkey) {
      loadInventory()
    }
  }, [pubkey, loadInventory])

  return {
    extractWords,
    getExtractedWords,
    collect,
    isCollecting,
    inventory,
    totalCount,
    uniqueCount,
    loadInventory,
    isLoadingInventory,
    celebrationWord,
    clearCelebration,
  }
}
