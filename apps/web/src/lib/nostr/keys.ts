import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import {
  getSecretKey,
  setSecretKey,
  clearSecretKey as clearStoredSecretKey,
  getUseNip07,
  setUseNip07,
  clearCachedProfile,
} from '../storage'

declare global {
  interface Window {
    nostr?: {
      getPublicKey: () => Promise<string>
      signEvent: (event: unknown) => Promise<unknown>
    }
  }
}

export function hasNip07(): boolean {
  return typeof window !== 'undefined' && !!window.nostr
}

// Check if NIP-07 is both available AND enabled by user
export function isNip07Enabled(): boolean {
  return hasNip07() && getUseNip07()
}

// Check if NIP-07 was enabled but extension is now missing
export function isNip07Missing(): boolean {
  return !hasNip07() && getUseNip07()
}

// Enable NIP-07 mode (clears stored secret key)
export function enableNip07(): void {
  clearStoredSecretKey()
  setUseNip07(true)
}

// Disable NIP-07 mode
export function disableNip07(): void {
  setUseNip07(false)
}

export async function getNip07PublicKey(): Promise<string | null> {
  if (!hasNip07()) return null
  try {
    return await window.nostr!.getPublicKey()
  } catch {
    return null
  }
}

export function getOrCreateSecretKey(): Uint8Array {
  if (typeof window === 'undefined') {
    throw new Error('Cannot access localStorage on server')
  }

  // When NIP-07 was enabled but extension is now missing, reset to fresh state
  // This treats the user as a first-time user, showing ProfileSetup screen
  if (isNip07Missing()) {
    disableNip07()
    clearCachedProfile()
  }

  const stored = getSecretKey()
  if (stored) {
    return hexToBytes(stored)
  }

  const sk = generateSecretKey()
  setSecretKey(bytesToHex(sk))
  return sk
}

export function getStoredSecretKey(): Uint8Array | null {
  const stored = getSecretKey()
  if (!stored) return null
  return hexToBytes(stored)
}

export function getPublicKeyFromSecret(sk: Uint8Array): string {
  return getPublicKey(sk)
}

export function exportNsec(sk: Uint8Array): string {
  return nip19.nsecEncode(sk)
}

export function exportNpub(pubkey: string): string {
  return nip19.npubEncode(pubkey)
}

export function importNsec(nsec: string): Uint8Array {
  const decoded = nip19.decode(nsec)
  if (decoded.type !== 'nsec') {
    throw new Error('Invalid nsec')
  }
  return decoded.data
}

export function saveSecretKey(sk: Uint8Array): void {
  setSecretKey(bytesToHex(sk))
}

export function clearSecretKey(): void {
  clearStoredSecretKey()
}

export function getMyPubkey(): string | null {
  const sk = getStoredSecretKey()
  if (!sk) return null
  return getPublicKey(sk)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16)
  }
  return bytes
}
