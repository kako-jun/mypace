// IndexedDB storage for Web Share Target API
// Used to temporarily store shared images from Android share menu

const DB_NAME = 'mypace-share-target'
const STORE_NAME = 'images'
const DB_VERSION = 1
const STALE_THRESHOLD_MS = 60 * 60 * 1000 // 1 hour

interface ShareTargetImage {
  id: 'pending'
  file: File
  timestamp: number
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

// Save shared image (called from Service Worker)
export async function saveShareTargetImage(file: File): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const data: ShareTargetImage = {
      id: 'pending',
      file,
      timestamp: Date.now(),
    }

    const request = store.put(data)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()

    transaction.oncomplete = () => db.close()
  })
}

// Get and delete shared image (called from HomePage)
// Returns null if no image or if image is stale (> 1 hour old)
export async function consumeShareTargetImage(): Promise<File | null> {
  const db = await openDB()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite')
    const store = transaction.objectStore(STORE_NAME)

    const getRequest = store.get('pending')

    getRequest.onerror = () => {
      db.close()
      reject(getRequest.error)
    }

    getRequest.onsuccess = () => {
      const data = getRequest.result as ShareTargetImage | undefined

      // Always delete the entry
      store.delete('pending')

      transaction.oncomplete = () => {
        db.close()

        if (!data) {
          resolve(null)
          return
        }

        // Check if stale
        if (Date.now() - data.timestamp > STALE_THRESHOLD_MS) {
          resolve(null)
          return
        }

        resolve(data.file)
      }
    }
  })
}
