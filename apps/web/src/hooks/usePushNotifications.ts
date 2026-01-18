import { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '../lib/api'

export type PushPreference = 'all' | 'replies_only'

interface PushStatus {
  supported: boolean
  permission: NotificationPermission
  subscribed: boolean
  preference: PushPreference | null
  loading: boolean
  error: string | null
}

interface UsePushNotificationsResult extends PushStatus {
  subscribe: (preference?: PushPreference) => Promise<boolean>
  unsubscribe: () => Promise<boolean>
  updatePreference: (preference: PushPreference) => Promise<boolean>
}

// Get current subscription from browser
async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null
  }

  try {
    const registration = await navigator.serviceWorker.ready
    return await registration.pushManager.getSubscription()
  } catch {
    return null
  }
}

// Get VAPID public key from server
async function getVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/push/vapid-public-key`)
    if (!res.ok) return null
    const data = await res.json()
    return data.publicKey || null
  } catch {
    return null
  }
}

// Convert VAPID public key to ArrayBuffer for subscribe
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray.buffer as ArrayBuffer
}

// Check subscription status on server
async function checkServerStatus(
  pubkey: string,
  endpoint: string
): Promise<{ subscribed: boolean; preference: PushPreference | null }> {
  try {
    const res = await fetch(`${API_BASE}/api/push/status?pubkey=${pubkey}&endpoint=${encodeURIComponent(endpoint)}`)
    if (!res.ok) return { subscribed: false, preference: null }
    const data = await res.json()
    return {
      subscribed: data.subscribed ?? false,
      preference: data.preference ?? null,
    }
  } catch {
    return { subscribed: false, preference: null }
  }
}

export function usePushNotifications(pubkey: string | null): UsePushNotificationsResult {
  const [status, setStatus] = useState<PushStatus>({
    supported: false,
    permission: 'default',
    subscribed: false,
    preference: null,
    loading: true,
    error: null,
  })

  // Check initial status
  useEffect(() => {
    const checkStatus = async () => {
      // Check browser support
      const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

      if (!supported) {
        setStatus({
          supported: false,
          permission: 'default',
          subscribed: false,
          preference: null,
          loading: false,
          error: null,
        })
        return
      }

      const permission = Notification.permission

      // Check current subscription
      const subscription = await getCurrentSubscription()

      if (!subscription || !pubkey) {
        setStatus({
          supported: true,
          permission,
          subscribed: false,
          preference: null,
          loading: false,
          error: null,
        })
        return
      }

      // Check server status
      const serverStatus = await checkServerStatus(pubkey, subscription.endpoint)

      setStatus({
        supported: true,
        permission,
        subscribed: serverStatus.subscribed,
        preference: serverStatus.preference,
        loading: false,
        error: null,
      })
    }

    checkStatus()
  }, [pubkey])

  // Subscribe to push notifications
  const subscribe = useCallback(
    async (preference: PushPreference = 'all'): Promise<boolean> => {
      if (!pubkey || !status.supported) return false

      setStatus((s) => ({ ...s, loading: true, error: null }))

      try {
        // Request notification permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setStatus((s) => ({
            ...s,
            permission,
            loading: false,
            error: 'Notification permission denied',
          }))
          return false
        }

        // Get VAPID public key
        const vapidPublicKey = await getVapidPublicKey()
        if (!vapidPublicKey) {
          setStatus((s) => ({
            ...s,
            loading: false,
            error: 'Failed to get VAPID key',
          }))
          return false
        }

        // Register service worker if not already
        const registration = await navigator.serviceWorker.ready

        // Subscribe to push
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })

        // Send to server
        const res = await fetch(`${API_BASE}/api/push/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey,
            subscription: subscription.toJSON(),
            preference,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to register subscription on server')
        }

        setStatus((s) => ({
          ...s,
          permission: 'granted',
          subscribed: true,
          preference,
          loading: false,
          error: null,
        }))

        return true
      } catch (e) {
        console.error('Push subscribe error:', e)
        setStatus((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to subscribe',
        }))
        return false
      }
    },
    [pubkey, status.supported]
  )

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!pubkey) return false

    setStatus((s) => ({ ...s, loading: true, error: null }))

    try {
      // Get current subscription
      const subscription = await getCurrentSubscription()

      if (subscription) {
        // Unsubscribe from browser
        await subscription.unsubscribe()

        // Remove from server
        await fetch(`${API_BASE}/api/push/unsubscribe`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey,
            endpoint: subscription.endpoint,
          }),
        })
      }

      setStatus((s) => ({
        ...s,
        subscribed: false,
        preference: null,
        loading: false,
        error: null,
      }))

      return true
    } catch (e) {
      console.error('Push unsubscribe error:', e)
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to unsubscribe',
      }))
      return false
    }
  }, [pubkey])

  // Update preference
  const updatePreference = useCallback(
    async (preference: PushPreference): Promise<boolean> => {
      if (!pubkey || !status.subscribed) return false

      setStatus((s) => ({ ...s, loading: true, error: null }))

      try {
        const subscription = await getCurrentSubscription()
        if (!subscription) {
          throw new Error('No active subscription')
        }

        const res = await fetch(`${API_BASE}/api/push/preference`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pubkey,
            endpoint: subscription.endpoint,
            preference,
          }),
        })

        if (!res.ok) {
          throw new Error('Failed to update preference')
        }

        setStatus((s) => ({
          ...s,
          preference,
          loading: false,
          error: null,
        }))

        return true
      } catch (e) {
        console.error('Update preference error:', e)
        setStatus((s) => ({
          ...s,
          loading: false,
          error: e instanceof Error ? e.message : 'Failed to update',
        }))
        return false
      }
    },
    [pubkey, status.subscribed]
  )

  return {
    ...status,
    subscribe,
    unsubscribe,
    updatePreference,
  }
}
