/**
 * Generate VAPID keys for Web Push notifications
 *
 * Usage:
 *   npx tsx scripts/generate-vapid-keys.ts
 *
 * Then set the keys as Cloudflare Workers secrets:
 *   wrangler secret put VAPID_PUBLIC_KEY
 *   wrangler secret put VAPID_PRIVATE_KEY
 */

async function generateVapidKeys() {
  // Generate ECDSA P-256 key pair
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  )

  // Export public key in raw format (for VAPID)
  const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
  const publicKeyBase64 = uint8ArrayToBase64url(new Uint8Array(publicKeyRaw))

  // Export private key in PKCS8 format
  const privateKeyPkcs8 = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
  const privateKeyBase64 = uint8ArrayToBase64url(new Uint8Array(privateKeyPkcs8))

  console.log('='.repeat(60))
  console.log('VAPID Keys Generated Successfully!')
  console.log('='.repeat(60))
  console.log('')
  console.log('Public Key (use this in your frontend and as VAPID_PUBLIC_KEY):')
  console.log(publicKeyBase64)
  console.log('')
  console.log('Private Key (use this as VAPID_PRIVATE_KEY secret):')
  console.log(privateKeyBase64)
  console.log('')
  console.log('='.repeat(60))
  console.log('Setup Instructions:')
  console.log('='.repeat(60))
  console.log('')
  console.log('1. Set secrets in Cloudflare Workers:')
  console.log('   wrangler secret put VAPID_PUBLIC_KEY')
  console.log('   (paste the public key)')
  console.log('')
  console.log('   wrangler secret put VAPID_PRIVATE_KEY')
  console.log('   (paste the private key)')
  console.log('')
  console.log('2. VAPID_SUBJECT is already set in wrangler.toml')
  console.log('')
}

function uint8ArrayToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

generateVapidKeys().catch(console.error)
