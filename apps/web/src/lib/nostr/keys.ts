import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import { getSecretKey, setSecretKey, clearSecretKey as clearStoredSecretKey } from '../storage'

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
