// Mute list management (user blocklist)
import { nip19 } from 'nostr-tools'
import { STORAGE_KEYS } from '../constants'

export interface MuteEntry {
  npub: string // Display format (npub1...)
  pubkey: string // Hex format for matching
  addedAt: number // timestamp
}

// Load mute list from localStorage
export function loadMuteList(): MuteEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.MUTE_LIST)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

// Save mute list to localStorage
function saveMuteList(list: MuteEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.MUTE_LIST, JSON.stringify(list))
    // Dispatch custom event for same-tab updates
    window.dispatchEvent(new CustomEvent('mypace:muteListChanged'))
  } catch {
    // Ignore storage errors
  }
}

// Convert npub to hex pubkey
export function npubToHex(npub: string): string | null {
  try {
    const decoded = nip19.decode(npub)
    if (decoded.type === 'npub') {
      return decoded.data
    }
    // Also handle nprofile
    if (decoded.type === 'nprofile') {
      return decoded.data.pubkey
    }
  } catch {
    // Invalid npub
  }
  return null
}

// Convert hex pubkey to npub
export function hexToNpub(hex: string): string {
  return nip19.npubEncode(hex)
}

// Add a user to mute list (accepts npub or hex)
export function addToMuteList(input: string): MuteEntry | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  let pubkey: string
  let npub: string

  // Check if input is npub or hex
  if (trimmed.startsWith('npub1')) {
    const hex = npubToHex(trimmed)
    if (!hex) return null
    pubkey = hex
    npub = trimmed
  } else if (/^[0-9a-f]{64}$/i.test(trimmed)) {
    // Hex pubkey
    pubkey = trimmed.toLowerCase()
    npub = hexToNpub(pubkey)
  } else {
    return null
  }

  const list = loadMuteList()

  // Check if already muted
  if (list.some((entry) => entry.pubkey === pubkey)) {
    return null
  }

  const entry: MuteEntry = {
    npub,
    pubkey,
    addedAt: Date.now(),
  }

  list.push(entry)
  saveMuteList(list)

  return entry
}

// Remove a user from mute list by pubkey (hex)
export function removeFromMuteList(pubkey: string): boolean {
  const list = loadMuteList()
  const index = list.findIndex((entry) => entry.pubkey === pubkey)

  if (index === -1) {
    return false
  }

  list.splice(index, 1)
  saveMuteList(list)

  return true
}

// Check if a pubkey is muted
export function isMuted(pubkey: string): boolean {
  const list = loadMuteList()
  return list.some((entry) => entry.pubkey === pubkey)
}

// Get list of muted pubkeys (hex) for filtering
export function getMutedPubkeys(): string[] {
  return loadMuteList().map((entry) => entry.pubkey)
}

// Clear entire mute list
export function clearMuteList(): void {
  saveMuteList([])
}

// Import mute list (for settings import)
export function importMuteList(entries: MuteEntry[]): void {
  saveMuteList(entries)
}
