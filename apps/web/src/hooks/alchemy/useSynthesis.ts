import { useState, useCallback, useEffect } from 'react'
import { synthesizeWords, type AlchemyWord } from '../../lib/api/api'
import { getStoredSecretKey, getPublicKeyFromSecret } from '../../lib/nostr/keys'

export interface SynthesisResult {
  result: AlchemyWord
  isNewSynthesis: boolean
  isNewWord: boolean
  formula: string
}

export interface UseSynthesisReturn {
  // Slots
  slotA: string | null
  slotB: string | null
  slotC: string | null
  setSlotA: (word: string | null) => void
  setSlotB: (word: string | null) => void
  setSlotC: (word: string | null) => void
  clearSlots: () => void

  // Synthesis
  synthesize: () => Promise<SynthesisResult | null>
  isSynthesizing: boolean
  error: string | null

  // Result
  lastResult: SynthesisResult | null
  clearResult: () => void

  // Validation
  canSynthesize: boolean
}

export function useSynthesis(): UseSynthesisReturn {
  const [pubkey, setPubkey] = useState<string | null>(null)
  const [slotA, setSlotA] = useState<string | null>(null)
  const [slotB, setSlotB] = useState<string | null>(null)
  const [slotC, setSlotC] = useState<string | null>(null)
  const [isSynthesizing, setIsSynthesizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SynthesisResult | null>(null)

  // Get pubkey from stored secret key
  useEffect(() => {
    const sk = getStoredSecretKey()
    if (sk) {
      const pk = getPublicKeyFromSecret(sk)
      setPubkey(pk)
    }
  }, [])

  const canSynthesize = !!(slotA && slotB && slotC && pubkey)

  const clearSlots = useCallback(() => {
    setSlotA(null)
    setSlotB(null)
    setSlotC(null)
    setError(null)
  }, [])

  const clearResult = useCallback(() => {
    setLastResult(null)
  }, [])

  const synthesize = useCallback(async (): Promise<SynthesisResult | null> => {
    if (!canSynthesize || !pubkey || !slotA || !slotB || !slotC) {
      return null
    }

    setIsSynthesizing(true)
    setError(null)

    try {
      const result = await synthesizeWords(pubkey, slotA, slotB, slotC)

      if (result.error) {
        setError(result.error)
        return null
      }

      if (result.result) {
        const synthesisResult: SynthesisResult = {
          result: result.result,
          isNewSynthesis: result.isNewSynthesis,
          isNewWord: result.isNewWord,
          formula: result.formula,
        }

        setLastResult(synthesisResult)
        return synthesisResult
      }

      setError('Synthesis failed')
      return null
    } catch {
      setError('Network error')
      return null
    } finally {
      setIsSynthesizing(false)
    }
  }, [canSynthesize, pubkey, slotA, slotB, slotC])

  return {
    slotA,
    slotB,
    slotC,
    setSlotA,
    setSlotB,
    setSlotC,
    clearSlots,
    synthesize,
    isSynthesizing,
    error,
    lastResult,
    clearResult,
    canSynthesize,
  }
}
