import { useState, useCallback } from 'hono/jsx'
import { TIMEOUTS } from '../lib/constants'

// Hook for temporary state that resets after a timeout
export function useTemporaryState<T>(
  initialValue: T,
  duration: number = TIMEOUTS.COPY_FEEDBACK
): [T, (value: T) => void] {
  const [state, setState] = useState<T>(initialValue)

  const setTemporaryState = useCallback((value: T) => {
    setState(value)
    setTimeout(() => setState(initialValue), duration)
  }, [initialValue, duration])

  return [state, setTemporaryState]
}

// Hook for temporary boolean flag (common use case)
export function useTemporaryFlag(
  duration: number = TIMEOUTS.COPY_FEEDBACK
): [boolean, () => void] {
  const [flag, setFlag] = useTemporaryState(false, duration)
  const trigger = useCallback(() => setFlag(true), [setFlag])
  return [flag, trigger]
}
