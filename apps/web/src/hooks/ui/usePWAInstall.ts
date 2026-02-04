import { useState, useEffect, useCallback } from 'react'
import type { BeforeInstallPromptEvent } from '../../types'

const STORAGE_KEY = 'pwa-install-dismissed'
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface UsePWAInstallReturn {
  canInstall: boolean
  isInstalled: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | null>
  dismiss: () => void
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (!dismissed) return false
    const dismissedAt = parseInt(dismissed, 10)
    // Check if dismiss period has expired
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
      setDeferredPrompt(e as unknown as BeforeInstallPromptEvent)
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
    localStorage.setItem(STORAGE_KEY, Date.now().toString())
  }, [])

  return {
    canInstall: !!deferredPrompt && !isDismissed && !isInstalled,
    isInstalled,
    promptInstall,
    dismiss,
  }
}
