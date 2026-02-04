import { useState, useEffect, useCallback } from 'react'
import { getPWAInstallDismissedAt, setPWAInstallDismissedAt } from '../../lib/storage'

/**
 * BeforeInstallPromptEvent - Browser event for PWA installation
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
  prompt(): Promise<void>
}

interface UsePWAInstallReturn {
  canInstall: boolean
  isInstalled: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>
  dismiss: () => void
}

const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(() => {
    const dismissedAt = getPWAInstallDismissedAt()
    if (!dismissedAt) return false
    return Date.now() - dismissedAt < DISMISS_DURATION_MS
  })

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true

    if (isStandalone) {
      setIsInstalled(true)
      return
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | null> => {
    if (!deferredPrompt) return null
    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      return outcome
    } catch {
      return null
    }
  }, [deferredPrompt])

  const dismiss = useCallback(() => {
    setIsDismissed(true)
    setPWAInstallDismissedAt(Date.now())
  }, [])

  return {
    canInstall: !!deferredPrompt && !isDismissed && !isInstalled,
    isInstalled,
    promptInstall,
    dismiss,
  }
}
