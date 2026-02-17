// Timeout values (ms)
export const TIMEOUTS = {
  COPY_FEEDBACK: 2000,
  DELETE_CONFIRMATION: 1500,
  NEW_POST_RELOAD: 1000,
  POST_ACTION_RELOAD: 1500,
  DRAFT_SAVE_DELAY: 1000,
} as const

// Content limits
export const LIMITS = {
  MAX_POST_LENGTH: 4200,
  PREVIEW_TRUNCATE_LENGTH: 280,
  PREVIEW_LINE_THRESHOLD: 28,
  FOLD_THRESHOLD: 280, // Same as PREVIEW_TRUNCATE_LENGTH for consistency
  TIMELINE_FETCH_LIMIT: 200,
  MAX_TIMELINE_ITEMS: 200, // DOM element limit to prevent performance degradation
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_VIDEO_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_AUDIO_SIZE: 1 * 1024 * 1024, // 1MB
  MAX_STICKERS: 10,
} as const

// Custom window events
export const CUSTOM_EVENTS = {
  NEW_POST: 'newpost',
  PROFILE_UPDATED: 'profileupdated',
  THEME_COLORS_CHANGED: 'themecolorschanged',
  APP_THEME_CHANGED: 'appthemechanged',
  LOGO_CLICKED: 'logoclicked',
  OPEN_FILTER_PANEL: 'openfilterpanel',
  FILTER_APPLIED: 'filterapplied',
} as const

// Supported languages for filtering
export const LANGUAGES = [
  { code: '', label: 'All Languages' },
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ko', label: '한국어' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
] as const

// Reaction content
export const REACTION = {
  DEFAULT_CONTENT: '+',
  VALID_CONTENTS: ['+', ''] as const,
} as const

export function isValidReaction(content: string): boolean {
  return content === '+' || content === ''
}

// Filter gacha presets
export const FILTER_PRESETS = [
  { name: 'Fuji', filter: 'brightness(1.1) contrast(1.3) saturate(1.2) hue-rotate(-5deg)', color: '#00a86b' },
  { name: 'Kodak', filter: 'brightness(1.05) contrast(1.2) saturate(0.9) sepia(0.15)', color: '#e6a817' },
  { name: 'Wash', filter: 'brightness(1.15) contrast(0.85) saturate(0.7)', color: '#b8a9c9' },
  { name: 'Xpro', filter: 'brightness(1.05) contrast(1.4) saturate(1.3) hue-rotate(15deg)', color: '#e04070' },
  { name: 'Mono', filter: 'brightness(1.1) contrast(1.4) grayscale(1)', color: '#606060' },
  { name: 'Cool', filter: 'brightness(1.05) contrast(1.2) saturate(0.85) hue-rotate(20deg)', color: '#4a90d9' },
  { name: 'Vivid', filter: 'contrast(1.2) saturate(1.4)', color: '#ff6b35' },
] as const

export type FilterPreset = (typeof FILTER_PRESETS)[number]

// Default theme colors (white)
export const DEFAULT_COLORS = {
  topLeft: '#f8f8f8',
  topRight: '#f8f8f8',
  bottomLeft: '#f8f8f8',
  bottomRight: '#f8f8f8',
} as const
