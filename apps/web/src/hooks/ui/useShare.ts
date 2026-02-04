import { useState } from 'react'
import { TIMEOUTS } from '../../lib/constants'

export function useShare() {
  const [copied, setCopied] = useState(false)

  const share = async (url: string): Promise<boolean> => {
    const shareData = { url }

    // Check if Web Share API is available and can share this data
    const canUseShare =
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare(shareData)

    if (canUseShare) {
      try {
        await navigator.share(shareData)
        return true
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          return false
        }
        // Fallback to copy for other errors
      }
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), TIMEOUTS.COPY_FEEDBACK)
    return true
  }

  return { copied, share }
}
