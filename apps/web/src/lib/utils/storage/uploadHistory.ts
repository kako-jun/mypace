import { STORAGE_KEYS } from '../../constants'
import { getItem, setItem } from './storage'

export interface UploadHistoryItem {
  url: string
  type: 'image' | 'video' | 'audio'
  filename: string
  uploadedAt: number
}

const MAX_HISTORY_ITEMS = 100

export function getUploadHistory(): UploadHistoryItem[] {
  return getItem<UploadHistoryItem[]>(STORAGE_KEYS.UPLOAD_HISTORY, [])
}

export function addUploadToHistory(url: string, filename: string, mimeType: string): void {
  const history = getUploadHistory()

  // Determine type from mime type
  let type: UploadHistoryItem['type'] = 'image'
  if (mimeType.startsWith('video/')) {
    type = 'video'
  } else if (mimeType.startsWith('audio/')) {
    type = 'audio'
  }

  const newItem: UploadHistoryItem = {
    url,
    type,
    filename,
    uploadedAt: Date.now(),
  }

  // Add to beginning, remove duplicates, limit size
  const filtered = history.filter((item) => item.url !== url)
  const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS)

  setItem(STORAGE_KEYS.UPLOAD_HISTORY, updated)
}

export function removeUploadFromHistory(url: string): void {
  const history = getUploadHistory()
  const updated = history.filter((item) => item.url !== url)
  setItem(STORAGE_KEYS.UPLOAD_HISTORY, updated)
}

export function clearUploadHistory(): void {
  setItem(STORAGE_KEYS.UPLOAD_HISTORY, [])
}

// Extract hash from nostr.build URL for deletion
export function extractNostrBuildHash(url: string): string | null {
  // URL format: https://i.nostr.build/abc123.jpg or https://nostr.build/i/abc123.jpg
  const match = url.match(/nostr\.build\/(?:i\/)?([^.]+)/)
  return match ? match[1] : null
}

export function getNostrBuildDeleteUrl(url: string): string {
  const hash = extractNostrBuildHash(url)
  if (hash) {
    return `https://nostr.build/delete/?hash=${encodeURIComponent(hash)}`
  }
  return `https://nostr.build/delete/?url=${encodeURIComponent(url)}`
}
