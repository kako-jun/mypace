/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// Precache and route
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

interface PushPayload {
  title?: string
  body?: string
  tag?: string
  data?: {
    url?: string
  }
}

// Push notification handler
self.addEventListener('push', (event) => {
  if (!event.data) return

  try {
    const payload: PushPayload = event.data.json()
    const { title, body, tag, data } = payload

    // Use type assertion for extended NotificationOptions
    const options = {
      body: body || 'New notification from MY PACE',
      tag: tag || 'mypace-notification',
      icon: '/static/pwa-icon-192.webp',
      badge: '/static/pwa-icon-192.webp',
      data: data || {},
      renotify: true,
      requireInteraction: false,
    } as NotificationOptions

    event.waitUntil(self.registration.showNotification(title || 'MY PACE', options))
  } catch (e) {
    console.error('Push notification error:', e)
  }
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus()
          // Navigate to the URL if needed
          if (urlToOpen !== '/') {
            client.navigate(urlToOpen)
          }
          return
        }
      }
      // If no window is open, open a new one
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen)
      }
    })
  )
})

// Notification close handler (optional)
self.addEventListener('notificationclose', (_event) => {
  // Could track notification dismissals here if needed
})
