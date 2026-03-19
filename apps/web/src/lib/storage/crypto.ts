// AES-GCM encryption for localStorage secrets
// Uses Web Crypto API with a device-derived key (PBKDF2)
// Unified with agasteer's crypto.ts implementation

const ENCRYPTION_ALGORITHM = 'AES-GCM'
const KEY_DERIVATION_ALGORITHM = 'PBKDF2'
const IV_LENGTH = 12 // AES-GCM recommended IV length
const SALT_LENGTH = 16
const KEY_LENGTH = 256
const ITERATIONS = 100000
const ENCRYPTED_PREFIX = 'enc:'

/**
 * Device-specific seed for key derivation.
 * Not fully unique, but ensures localStorage dumps alone cannot decrypt.
 */
function getDeviceSeed(): string {
  const origin = globalThis.location?.origin || 'mypace-default'
  const ua = globalThis.navigator?.userAgent || 'unknown-agent'
  return `mypace-sk-encryption:${origin}:${ua.length}`
}

/**
 * Derive AES-GCM key from device seed + salt (PBKDF2).
 */
async function deriveKey(salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const seed = encoder.encode(getDeviceSeed())

  const keyMaterial = await crypto.subtle.importKey('raw', seed, KEY_DERIVATION_ALGORITHM, false, ['deriveKey'])

  return crypto.subtle.deriveKey(
    {
      name: KEY_DERIVATION_ALGORITHM,
      salt: salt.buffer as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt plaintext. Returns "enc:" + base64(salt + iv + ciphertext).
 * Salt is embedded in the output (no separate localStorage key needed).
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  if (!plaintext) return ''

  // Fallback for environments without Web Crypto API
  if (!crypto?.subtle) {
    console.warn('Web Crypto API not available, using obfuscation fallback')
    return obfuscateSecret(plaintext)
  }

  try {
    const encoder = new TextEncoder()
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
    const key = await deriveKey(salt)

    const ciphertext = await crypto.subtle.encrypt({ name: ENCRYPTION_ALGORITHM, iv }, key, encoder.encode(plaintext))

    // salt + iv + ciphertext combined
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength)
    combined.set(salt, 0)
    combined.set(iv, salt.length)
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length)

    return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined))
  } catch (error) {
    console.error('Encryption failed, using obfuscation fallback:', error)
    return obfuscateSecret(plaintext)
  }
}

/**
 * Decrypt an encrypted string (with "enc:" or "obf:" prefix).
 * Plaintext values (no prefix) are returned as-is (migration path).
 */
export async function decryptSecret(stored: string): Promise<string> {
  if (!stored) return ''

  // Not encrypted — return as plaintext (legacy migration)
  if (!stored.startsWith(ENCRYPTED_PREFIX) && !stored.startsWith('obf:')) {
    return stored
  }

  // XOR obfuscation fallback
  if (stored.startsWith('obf:')) {
    return deobfuscateSecret(stored)
  }

  // Web Crypto API not available
  if (!crypto?.subtle) {
    console.warn('Web Crypto API not available, cannot decrypt')
    return ''
  }

  try {
    const data = Uint8Array.from(atob(stored.slice(ENCRYPTED_PREFIX.length)), (c) => c.charCodeAt(0))

    const salt = data.slice(0, SALT_LENGTH)
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const ciphertext = data.slice(SALT_LENGTH + IV_LENGTH)

    const key = await deriveKey(salt)

    const decrypted = await crypto.subtle.decrypt({ name: ENCRYPTION_ALGORITHM, iv }, key, ciphertext)

    return new TextDecoder().decode(decrypted)
  } catch {
    // Also try legacy format (salt stored separately in localStorage)
    try {
      return await decryptLegacyFormat(stored)
    } catch {
      console.error('Failed to decrypt secret key')
      return ''
    }
  }
}

/**
 * Try decrypting with legacy format (salt in separate localStorage key).
 * For backward compat with pre-unification crypto.ts.
 */
async function decryptLegacyFormat(stored: string): Promise<string> {
  const LEGACY_SALT_KEY = 'mypace_crypto_salt'
  const saltStr = localStorage.getItem(LEGACY_SALT_KEY)
  if (!saltStr) return ''

  const salt = Uint8Array.from(atob(saltStr), (c) => c.charCodeAt(0))
  // Legacy used origin-only seed without UA length
  const encoder = new TextEncoder()
  const legacySeed = encoder.encode('mypace-sk-encryption' + location.origin)
  const keyMaterial = await crypto.subtle.importKey('raw', legacySeed, 'PBKDF2', false, ['deriveKey'])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  const raw = stored.slice(ENCRYPTED_PREFIX.length)
  const combined = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)

  // Migration: remove legacy salt key (no longer needed)
  localStorage.removeItem(LEGACY_SALT_KEY)

  return new TextDecoder().decode(decrypted)
}

/**
 * Check if a stored value is encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX) || value.startsWith('obf:')
}

// ============================================
// Fallback: XOR obfuscation (for environments without Web Crypto API)
// ============================================

function obfuscateSecret(secret: string): string {
  const key = getDeviceSeed()
  const result: number[] = []
  for (let i = 0; i < secret.length; i++) {
    result.push(secret.charCodeAt(i) ^ key.charCodeAt(i % key.length))
  }
  return 'obf:' + btoa(String.fromCharCode(...result))
}

function deobfuscateSecret(obfuscated: string): string {
  try {
    const data = atob(obfuscated.slice(4))
    const key = getDeviceSeed()
    const result: string[] = []
    for (let i = 0; i < data.length; i++) {
      result.push(String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length)))
    }
    return result.join('')
  } catch {
    return ''
  }
}
