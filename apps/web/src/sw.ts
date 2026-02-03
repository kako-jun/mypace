/// <reference lib="webworker" />
/// <reference types="vite-plugin-pwa/client" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>
}

// Precache and route
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// Handle skip waiting message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Claim clients immediately when SW activates
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

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

// ============ Web Share Target API ============

const SHARE_TARGET_DB_NAME = 'mypace-share-target'
const SHARE_TARGET_STORE_NAME = 'images'

async function openShareTargetDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SHARE_TARGET_DB_NAME, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(SHARE_TARGET_STORE_NAME)) {
        db.createObjectStore(SHARE_TARGET_STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

async function saveShareTargetImage(file: File): Promise<void> {
  const db = await openShareTargetDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SHARE_TARGET_STORE_NAME, 'readwrite')
    const store = transaction.objectStore(SHARE_TARGET_STORE_NAME)
    const request = store.put({
      id: 'pending',
      file,
      timestamp: Date.now(),
    })
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
    transaction.oncomplete = () => db.close()
  })
}

async function handleShareTarget(request: Request): Promise<Response> {
  const formData = await request.formData()
  const files = formData.getAll('images') as File[]
  const text = formData.get('text') as string | null
  const url = formData.get('url') as string | null
  const title = formData.get('title') as string | null

  if (files.length > 0 && files[0].size > 0) {
    // Image shared: save to IndexedDB and redirect
    await saveShareTargetImage(files[0])
    return Response.redirect('/?share_image=pending', 303)
  }

  // Text only: redirect to existing intent/post endpoint
  const shareText = [title, text, url].filter(Boolean).join(' ')
  if (shareText) {
    const redirectUrl = `/intent/post?text=${encodeURIComponent(shareText)}`
    return Response.redirect(redirectUrl, 303)
  }

  // Nothing shared, just go to home
  return Response.redirect('/', 303)
}

// Fetch event handler for share target
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (url.pathname === '/share' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request))
  }
})
