// AES-GCM encryption for localStorage secrets
// Uses Web Crypto API with a device-derived key (from a stable salt stored alongside)

const CRYPTO_SALT_KEY = 'mypace_crypto_salt'
const KEY_USAGE_INFO = 'mypace-sk-encryption'
const ENCRYPTED_PREFIX = 'enc:' // Prefix to distinguish encrypted vs plaintext values

/**
 * Get or create a stable salt for this device/browser.
 * The salt itself is not secret -- it just ensures the derived key
 * is unique per browser profile.
 */
function getOrCreateSalt(): Uint8Array {
  const stored = localStorage.getItem(CRYPTO_SALT_KEY)
  if (stored) {
    return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
  }
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(CRYPTO_SALT_KEY, btoa(String.fromCharCode(...salt)))
  return salt
}

/**
 * Derive an AES-GCM key from the browser's origin + a per-device salt.
 * This is not a password -- it's a device-binding measure so that
 * the raw hex key is not trivially readable from localStorage.
 */
async function deriveKey(): Promise<CryptoKey> {
  const salt = getOrCreateSalt()
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(KEY_USAGE_INFO + location.origin),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt.buffer as ArrayBuffer, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a plaintext string. Returns base64(iv + ciphertext) prefixed with "enc:".
 */
export async function encryptSecret(plaintext: string): Promise<string> {
  if (!plaintext) return ''
  const key = await deriveKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  // Concatenate iv + ciphertext
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return ENCRYPTED_PREFIX + btoa(String.fromCharCode(...combined))
}

/**
 * Decrypt an encrypted string (with "enc:" prefix).
 * If the value is not encrypted (no prefix), returns it as-is (migration path).
 */
export async function decryptSecret(stored: string): Promise<string> {
  if (!stored) return ''

  // Not encrypted -- return as plaintext (legacy migration)
  if (!stored.startsWith(ENCRYPTED_PREFIX)) {
    return stored
  }

  const key = await deriveKey()
  const raw = stored.slice(ENCRYPTED_PREFIX.length)
  const combined = Uint8Array.from(atob(raw), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  try {
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
    return new TextDecoder().decode(decrypted)
  } catch {
    // Decryption failed (e.g., different origin/device) -- clear the corrupted key
    console.error('Failed to decrypt secret key -- clearing stored key')
    return ''
  }
}

/**
 * Check if a stored value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX)
}
