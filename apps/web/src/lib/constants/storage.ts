// LocalStorage keys
export const STORAGE_KEYS = {
  SECRET_KEY: 'mypace_sk',
  PROFILE: 'mypace_profile',
  THEME_COLORS: 'mypace_theme_colors',
  APP_THEME: 'mypace_app_theme',
  VIM_MODE: 'mypace_vim_mode',
  DRAFT: 'mypace_draft',
  SEARCH_FILTERS: 'mypace_search_filters',
  FILTER_PRESETS: 'mypace_filter_presets',
  MUTE_LIST: 'mypace_mute_list',
  UPLOAD_HISTORY: 'mypace_upload_history',
  // Legacy keys (kept for migration)
  MYPACE_ONLY: 'mypace_only',
  LANGUAGE_FILTER: 'mypace_language_filter',
  NG_WORDS: 'mypace_ng_words',
} as const
