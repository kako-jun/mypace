import { createContext, useContext, type ReactNode } from 'react'
import { useWordrotTimeline } from '../../hooks/wordrot'

type WordrotContextType = ReturnType<typeof useWordrotTimeline>

const WordrotContext = createContext<WordrotContextType | null>(null)

/**
 * Context provider for wordrot functionality
 * Wraps components that need access to word extraction and collection
 */
export function WordrotProvider({ children }: { children: ReactNode }) {
  const wordrotState = useWordrotTimeline()

  return <WordrotContext.Provider value={wordrotState}>{children}</WordrotContext.Provider>
}

/**
 * Hook to access wordrot context
 * Returns null if used outside of WordrotProvider
 */
export function useWordrotContext(): WordrotContextType | null {
  return useContext(WordrotContext)
}

/**
 * Hook to access wordrot context (throws if not in provider)
 */
export function useWordrotContextRequired(): WordrotContextType {
  const context = useContext(WordrotContext)
  if (!context) {
    throw new Error('useWordrotContextRequired must be used within WordrotProvider')
  }
  return context
}
