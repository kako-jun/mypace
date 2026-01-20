// Timestamp utilities
export const getCurrentTimestamp = (): number => Math.floor(Date.now() / 1000)

// Validation utilities
export const isValidPubkey = (pubkey: unknown): pubkey is string =>
  typeof pubkey === 'string' && pubkey.length === 64 && /^[0-9a-f]+$/i.test(pubkey)

export const isValidEventId = (eventId: unknown): eventId is string =>
  typeof eventId === 'string' && eventId.length === 64 && /^[0-9a-f]+$/i.test(eventId)

// Array utilities
export const uniqueArray = <T>(arr: T[]): T[] => [...new Set(arr)]

// Clamp number to range
export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

// Parse pagination parameter with clamping
export const parsePaginationLimit = (value: string | undefined, defaultLimit: number, maxLimit: number): number =>
  clamp(parseInt(value || String(defaultLimit), 10) || defaultLimit, 1, maxLimit)

export const parsePaginationOffset = (value: string | undefined): number => Math.max(0, parseInt(value || '0', 10) || 0)
