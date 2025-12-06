# Nostr Integration

## Authentication

### Auto-generated Keys (Default)
- First visit: generate secret key via `crypto.getRandomValues()`
- Store in `localStorage` as hex
- No registration required

### NIP-07 (Browser Extension)
- If extension detected (nos2x, Alby, etc.), use it
- More secure: key never leaves extension
- User can export nsec from Settings to use extension

## Key Management

```typescript
// app/lib/nostr/keys.ts

getOrCreateSecretKey()  // Get or generate key
exportNsec(sk)          // Export as nsec1...
importNsec(nsec)        // Import nsec1...
hasNip07()              // Check extension
```

## Events

### kind:1 (Text Note)
```typescript
{
  kind: 1,
  created_at: timestamp,
  tags: [],
  content: "Hello world",
  pubkey: "...",
  id: "...",
  sig: "..."
}
```

## Relays

Default relays in `app/lib/nostr/relay.ts`:
```typescript
const RELAYS = [
  'wss://nos.lol',
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
]
```

## Security

- Secret key NEVER sent to server
- Post signing happens client-side only
- localStorage key can be cleared anytime
- NIP-07 preferred for long-term use
