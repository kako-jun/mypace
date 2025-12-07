// Timeout values (ms)
export const TIMEOUTS = {
  COPY_FEEDBACK: 2000,
  DELETE_CONFIRMATION: 1500,
  NEW_POST_RELOAD: 1000,
  POST_ACTION_RELOAD: 1500,
  DRAFT_SAVE_DELAY: 500,
} as const

// Content limits
export const LIMITS = {
  MAX_POST_LENGTH: 4200,
  PREVIEW_TRUNCATE_LENGTH: 420,
  PREVIEW_LINE_THRESHOLD: 42,
  TIMELINE_FETCH_LIMIT: 50,
  MAX_IMAGE_SIZE: 5 * 1024 * 1024, // 5MB
} as const

// Custom window events
export const CUSTOM_EVENTS = {
  NEW_POST: 'newpost',
  PROFILE_UPDATED: 'profileupdated',
} as const

// API endpoints
export const API_ENDPOINTS = {
  TIMELINE: '/api/timeline',
} as const

// Reaction content
export const REACTION = {
  DEFAULT_CONTENT: '+',
  VALID_CONTENTS: ['+', ''] as const,
} as const

export function isValidReaction(content: string): boolean {
  return content === '+' || content === ''
}
