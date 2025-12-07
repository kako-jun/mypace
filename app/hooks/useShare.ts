import { useState } from 'hono/jsx'

export function useShare() {
  const [copied, setCopied] = useState(false)

  const share = async (url: string): Promise<boolean> => {
    if (navigator.share) {
      try {
        await navigator.share({ url })
        return true
      } catch (e) {
        if ((e as Error).name === 'AbortError') {
          return false
        }
        // Fallback to copy
      }
    }

    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    return true
  }

  return { copied, share }
}
