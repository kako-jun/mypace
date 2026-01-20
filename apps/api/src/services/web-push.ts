/**
 * Web Push notification service
 * - VAPID authentication
 * - Payload encryption using Web Crypto API
 * - Automatic cleanup of invalid subscriptions (410 Gone)
 */

import type { D1Database } from '@cloudflare/workers-types'
import { getCurrentTimestamp } from '../utils'
import { VAPID_JWT_EXPIRATION, PUSH_TTL } from '../constants'

export interface PushSubscription {
  id: number
  pubkey: string
  endpoint: string
  auth: string
  p256dh: string
  preference: 'all' | 'replies_only'
}

export interface PushPayload {
  title: string
  body: string
  tag: string // For notification grouping
  data?: {
    url?: string
  }
}

export type NotificationType = 'stella' | 'reply' | 'repost'

interface VapidKeys {
  publicKey: string
  privateKey: string
}

// Convert base64url to Uint8Array
function base64urlToUint8Array(base64url: string): Uint8Array {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const binary = atob(base64 + padding)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Convert Uint8Array to base64url
function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

// Generate VAPID JWT token
async function generateVapidJwt(
  audience: string,
  subject: string,
  privateKeyBase64: string,
  expiration: number
): Promise<string> {
  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = {
    aud: audience,
    exp: expiration,
    sub: subject,
  }

  const headerB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(header)))
  const payloadB64 = uint8ArrayToBase64url(new TextEncoder().encode(JSON.stringify(payload)))
  const unsignedToken = `${headerB64}.${payloadB64}`

  // Import private key
  const privateKeyBytes = base64urlToUint8Array(privateKeyBase64)
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKeyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  // Sign
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken)
  )

  // Convert signature from DER to raw format (64 bytes)
  const signatureBytes = new Uint8Array(signature)
  const signatureB64 = uint8ArrayToBase64url(signatureBytes)

  return `${unsignedToken}.${signatureB64}`
}

// Encrypt payload for Web Push (RFC 8291)
async function encryptPayload(
  payload: string,
  p256dhBase64: string,
  authBase64: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  // Generate local ECDH key pair
  const localKeyPair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair

  // Import subscriber's public key
  const p256dhBytes = base64urlToUint8Array(p256dhBase64)
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    p256dhBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // Derive shared secret using ECDH

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey } as any,
    localKeyPair.privateKey,
    256
  )

  // Export local public key
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey)
  const localPublicKey = new Uint8Array(localPublicKeyRaw as ArrayBuffer)

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // Auth secret
  const authSecret = base64urlToUint8Array(authBase64)

  // Derive PRK using HKDF
  const sharedSecretKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits'])

  // Info for auth
  const authInfo = new TextEncoder().encode('Content-Encoding: auth\0')
  const prkBits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: authInfo },
    sharedSecretKey,
    256
  )

  // Derive CEK and nonce
  const prkKey = await crypto.subtle.importKey('raw', prkBits, { name: 'HKDF' }, false, ['deriveBits'])

  // Build context for key derivation
  const keyInfo = buildInfo('aesgcm', p256dhBytes, localPublicKey)
  const nonceInfo = buildInfo('nonce', p256dhBytes, localPublicKey)

  const cekBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: keyInfo }, prkKey, 128)

  const nonceBits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo }, prkKey, 96)

  // Encrypt with AES-GCM
  const cek = await crypto.subtle.importKey('raw', cekBits, { name: 'AES-GCM' }, false, ['encrypt'])

  // Add padding (2 bytes length + padding + payload)
  const payloadBytes = new TextEncoder().encode(payload)
  const paddingLength = 0
  const padded = new Uint8Array(2 + paddingLength + payloadBytes.length)
  padded[0] = (paddingLength >> 8) & 0xff
  padded[1] = paddingLength & 0xff
  padded.set(payloadBytes, 2 + paddingLength)

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonceBits }, cek, padded)

  return {
    encrypted: new Uint8Array(encrypted),
    salt,
    localPublicKey,
  }
}

function buildInfo(type: string, clientPublicKey: Uint8Array, serverPublicKey: Uint8Array): Uint8Array {
  const encoder = new TextEncoder()
  const contentEncoding = encoder.encode(`Content-Encoding: ${type}\0`)
  const p256ecdsa = encoder.encode('P-256\0')

  const info = new Uint8Array(
    contentEncoding.length + p256ecdsa.length + 2 + clientPublicKey.length + 2 + serverPublicKey.length
  )

  let offset = 0
  info.set(contentEncoding, offset)
  offset += contentEncoding.length

  info.set(p256ecdsa, offset)
  offset += p256ecdsa.length

  info[offset++] = 0
  info[offset++] = clientPublicKey.length
  info.set(clientPublicKey, offset)
  offset += clientPublicKey.length

  info[offset++] = 0
  info[offset++] = serverPublicKey.length
  info.set(serverPublicKey, offset)

  return info
}

/**
 * Send a push notification to a single subscription
 * Returns true if successful, false if subscription should be deleted
 */
export async function sendPushNotification(
  subscription: PushSubscription,
  payload: PushPayload,
  vapidKeys: VapidKeys,
  vapidSubject: string
): Promise<{ success: boolean; shouldDelete: boolean }> {
  try {
    const payloadString = JSON.stringify(payload)

    // Encrypt payload
    const { encrypted, salt, localPublicKey } = await encryptPayload(
      payloadString,
      subscription.p256dh,
      subscription.auth
    )

    // Parse endpoint URL for audience
    const endpointUrl = new URL(subscription.endpoint)
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`

    // Generate VAPID JWT
    const expiration = getCurrentTimestamp() + VAPID_JWT_EXPIRATION
    const jwt = await generateVapidJwt(audience, vapidSubject, vapidKeys.privateKey, expiration)

    // Build request
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        Encryption: `salt=${uint8ArrayToBase64url(salt)}`,
        'Crypto-Key': `dh=${uint8ArrayToBase64url(localPublicKey)};p256ecdsa=${vapidKeys.publicKey}`,
        Authorization: `WebPush ${jwt}`,
        TTL: String(PUSH_TTL),
      },
      body: encrypted,
    })

    if (response.ok || response.status === 201) {
      return { success: true, shouldDelete: false }
    }

    // 404 or 410: Subscription is no longer valid
    if (response.status === 404 || response.status === 410) {
      console.log(`Push subscription expired or invalid: ${subscription.endpoint}`)
      return { success: false, shouldDelete: true }
    }

    // Other errors: don't delete, might be temporary
    console.error(`Push failed with status ${response.status}: ${await response.text()}`)
    return { success: false, shouldDelete: false }
  } catch (error) {
    console.error('Push notification error:', error)
    return { success: false, shouldDelete: false }
  }
}

/**
 * Send push notifications to all subscriptions for a user
 * Automatically cleans up invalid subscriptions
 */
export async function sendPushToUser(
  db: D1Database,
  recipientPubkey: string,
  notificationType: NotificationType,
  vapidKeys: VapidKeys,
  vapidSubject: string
): Promise<void> {
  // Get all subscriptions for this user
  const subscriptions = await db
    .prepare(
      `SELECT id, pubkey, endpoint, auth, p256dh, preference
       FROM push_subscriptions
       WHERE pubkey = ?`
    )
    .bind(recipientPubkey)
    .all<PushSubscription>()

  if (!subscriptions.results || subscriptions.results.length === 0) {
    return
  }

  // Build payload based on notification type
  const payload = buildPayload(notificationType)

  // Filter by preference
  const eligibleSubscriptions = subscriptions.results.filter((sub) => {
    if (sub.preference === 'all') return true
    if (sub.preference === 'replies_only' && notificationType === 'reply') return true
    return false
  })

  // Send to all eligible subscriptions
  const idsToDelete: number[] = []

  await Promise.all(
    eligibleSubscriptions.map(async (sub) => {
      const result = await sendPushNotification(sub, payload, vapidKeys, vapidSubject)
      if (result.shouldDelete) {
        idsToDelete.push(sub.id)
      }
    })
  )

  // Clean up invalid subscriptions
  if (idsToDelete.length > 0) {
    const placeholders = idsToDelete.map(() => '?').join(',')
    await db
      .prepare(`DELETE FROM push_subscriptions WHERE id IN (${placeholders})`)
      .bind(...idsToDelete)
      .run()
    console.log(`Cleaned up ${idsToDelete.length} invalid push subscriptions`)
  }
}

/**
 * Build push payload based on notification type
 */
function buildPayload(type: NotificationType): PushPayload {
  switch (type) {
    case 'stella':
      return {
        title: 'MY PACE',
        body: 'New stella on your posts',
        tag: 'mypace-stella',
        data: { url: '/' },
      }
    case 'reply':
      return {
        title: 'MY PACE',
        body: 'New reply to your post',
        tag: 'mypace-reply',
        data: { url: '/' },
      }
    case 'repost':
      return {
        title: 'MY PACE',
        body: 'New repost of your post',
        tag: 'mypace-repost',
        data: { url: '/' },
      }
  }
}
