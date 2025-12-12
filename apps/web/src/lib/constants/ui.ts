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
  MYPACE_FILTER_CHANGED: 'mypacefilterchanged',
  LANGUAGE_FILTER_CHANGED: 'languagefilterchanged',
  THEME_COLORS_CHANGED: 'themecolorschanged',
  APP_THEME_CHANGED: 'appthemechanged',
  LOGO_CLICKED: 'logoclicked',
} as const

// Supported languages for filtering
export const LANGUAGES = [
  { code: '', label: 'All' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
] as const

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
