import type { Profile } from '../../types'

// Safe JSON parsing with fallback
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

// Parse profile JSON safely
export function parseProfile(json: string): Profile | null {
  return safeJsonParse<Profile | null>(json, null)
}

// Parse event JSON safely (for reposts)
export function parseEventJson<T>(json: string): T | null {
  return safeJsonParse<T | null>(json, null)
}
