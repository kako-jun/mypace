// Unified localStorage management under single "mypace" key
import type { ThemeColors, SearchFilters, FilterPreset, Profile } from '../../types'
import { DEFAULT_COLORS } from '../constants'

const STORAGE_KEY = 'mypace'

// Mute list entry type
export interface MuteEntry {
  npub: string
  pubkey: string
  addedAt: number
}

// Full storage structure
export interface MypaceStorage {
  // Exportable
  theme: {
    mode: 'light' | 'dark'
    colors: ThemeColors
  }
  filters: SearchFilters & {
    presets: FilterPreset[]
    muteList: MuteEntry[]
  }
  // Non-exportable
  auth: {
    sk: string
    useNip07: boolean
  }
  cache: {
    profile: Profile | null
  }
  editor: {
    vimMode: boolean
    draft: string
    draftReplyTo: string
  }
}

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  ngWords: [],
  ngTags: [],
  showSNS: true,
  showBlog: true,
  mypace: true,
  lang: '',
  hideAds: true,
  hideNSFW: true,
  hideNPC: false,
}

const DEFAULT_STORAGE: MypaceStorage = {
  theme: {
    mode: 'light',
    colors: DEFAULT_COLORS,
  },
  filters: {
    ...DEFAULT_SEARCH_FILTERS,
    presets: [],
    muteList: [],
  },
  auth: {
    sk: '',
    useNip07: false,
  },
  cache: {
    profile: null,
  },
  editor: {
    vimMode: false,
    draft: '',
    draftReplyTo: '',
  },
}

// Get browser default language
function getDefaultLanguage(): string {
  if (typeof navigator === 'undefined') return ''
  const SUPPORTED = ['ja', 'en', 'zh', 'ko', 'es', 'fr', 'de']
  const lang = navigator.language?.slice(0, 2).toLowerCase() || ''
  return SUPPORTED.includes(lang) ? lang : ''
}

// Clean SearchFilters object - only keep known fields
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanFilters(raw: any): SearchFilters {
  return {
    ngWords: raw?.ngWords ?? DEFAULT_SEARCH_FILTERS.ngWords,
    ngTags: raw?.ngTags ?? DEFAULT_SEARCH_FILTERS.ngTags,
    showSNS: raw?.showSNS ?? DEFAULT_SEARCH_FILTERS.showSNS,
    showBlog: raw?.showBlog ?? DEFAULT_SEARCH_FILTERS.showBlog,
    mypace: raw?.mypace ?? DEFAULT_SEARCH_FILTERS.mypace,
    lang: raw?.lang ?? DEFAULT_SEARCH_FILTERS.lang,
    hideAds: raw?.hideAds ?? DEFAULT_SEARCH_FILTERS.hideAds,
    hideNSFW: raw?.hideNSFW ?? DEFAULT_SEARCH_FILTERS.hideNSFW,
    hideNPC: raw?.hideNPC ?? DEFAULT_SEARCH_FILTERS.hideNPC,
  }
}

// Clean presets - remove legacy fields from each preset's filters
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function cleanPresets(rawPresets: any[]): FilterPreset[] {
  if (!Array.isArray(rawPresets)) return []
  return rawPresets.map((p) => ({
    id: p.id,
    name: p.name,
    filters: cleanFilters(p.filters),
    createdAt: p.createdAt ?? Date.now(),
  }))
}

// Read full storage
function readStorage(): MypaceStorage {
  if (typeof localStorage === 'undefined') return DEFAULT_STORAGE
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Deep merge with defaults (only pick known fields to avoid legacy data pollution)
      const pf = parsed.filters || {}
      return {
        theme: { ...DEFAULT_STORAGE.theme, ...parsed.theme },
        filters: {
          ...cleanFilters(pf),
          presets: cleanPresets(pf.presets),
          muteList: pf.muteList || [],
        },
        auth: { ...DEFAULT_STORAGE.auth, ...parsed.auth },
        cache: { ...DEFAULT_STORAGE.cache, ...parsed.cache },
        editor: { ...DEFAULT_STORAGE.editor, ...parsed.editor },
      }
    }
  } catch {
    // Ignore parse errors
  }
  // First time: use browser language
  return {
    ...DEFAULT_STORAGE,
    filters: {
      ...DEFAULT_SEARCH_FILTERS,
      lang: getDefaultLanguage(),
      presets: [],
      muteList: [],
    },
  }
}

// Write full storage
function writeStorage(data: MypaceStorage): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

// Update a section of storage
function updateStorage<K extends keyof MypaceStorage>(
  key: K,
  updater: (current: MypaceStorage[K]) => MypaceStorage[K]
): void {
  const data = readStorage()
  data[key] = updater(data[key])
  writeStorage(data)
}

// ============ Theme ============

export function getThemeMode(): 'light' | 'dark' {
  return readStorage().theme.mode
}

export function setThemeMode(mode: 'light' | 'dark'): void {
  updateStorage('theme', (t) => ({ ...t, mode }))
}

export function getThemeColors(): ThemeColors {
  return readStorage().theme.colors
}

export function setThemeColors(colors: ThemeColors): void {
  updateStorage('theme', (t) => ({ ...t, colors }))
}

export function resetThemeColors(): void {
  updateStorage('theme', (t) => ({ ...t, colors: DEFAULT_COLORS }))
}

// ============ Filters ============

export function getFilterSettings(): SearchFilters {
  const { presets: _p, muteList: _m, ...settings } = readStorage().filters
  return settings
}

export function setFilterSettings(settings: SearchFilters): void {
  updateStorage('filters', (f) => ({ ...f, ...settings }))
}

export function getFilterPresets(): FilterPreset[] {
  return readStorage().filters.presets
}

export function setFilterPresets(presets: FilterPreset[]): void {
  updateStorage('filters', (f) => ({ ...f, presets }))
}

export function getMuteList(): MuteEntry[] {
  return readStorage().filters.muteList
}

export function setMuteList(muteList: MuteEntry[]): void {
  updateStorage('filters', (f) => ({ ...f, muteList }))
}

// ============ Auth ============

// Legacy key for backward compatibility (remove after 2026-12-31)
const LEGACY_SK_KEY = 'mypace_sk'

export function getSecretKey(): string {
  const data = readStorage()
  if (data.auth.sk) {
    return data.auth.sk
  }

  // Fallback: check legacy key for users who haven't migrated yet
  // TODO: Remove this fallback after 2026-12-31
  if (typeof localStorage !== 'undefined') {
    const legacySk = localStorage.getItem(LEGACY_SK_KEY)
    if (legacySk) {
      // Migrate to new structure and remove legacy key
      updateStorage('auth', (a) => ({ ...a, sk: legacySk }))
      localStorage.removeItem(LEGACY_SK_KEY)
      return legacySk
    }
  }

  return ''
}

export function setSecretKey(sk: string): void {
  updateStorage('auth', (a) => ({ ...a, sk }))
}

export function clearSecretKey(): void {
  updateStorage('auth', (a) => ({ ...a, sk: '' }))
}

export function getUseNip07(): boolean {
  return readStorage().auth.useNip07
}

export function setUseNip07(useNip07: boolean): void {
  updateStorage('auth', (a) => ({ ...a, useNip07 }))
}

// ============ Cache ============

export function getCachedProfile(): Profile | null {
  return readStorage().cache.profile
}

export function setCachedProfile(profile: Profile): void {
  updateStorage('cache', (c) => ({ ...c, profile }))
}

export function clearCachedProfile(): void {
  updateStorage('cache', (c) => ({ ...c, profile: null }))
}

// ============ Editor ============

export function getVimMode(): boolean {
  return readStorage().editor.vimMode
}

export function setVimMode(enabled: boolean): void {
  updateStorage('editor', (e) => ({ ...e, vimMode: enabled }))
}

export function getDraft(): string {
  return readStorage().editor.draft
}

export function setDraft(draft: string): void {
  updateStorage('editor', (e) => ({ ...e, draft }))
}

export function getDraftReplyTo(): string {
  return readStorage().editor.draftReplyTo
}

export function setDraftReplyTo(replyTo: string): void {
  updateStorage('editor', (e) => ({ ...e, draftReplyTo: replyTo }))
}

export function clearDraft(): void {
  updateStorage('editor', (e) => ({ ...e, draft: '', draftReplyTo: '' }))
}

// ============ Export/Import ============

export interface ExportableSettings {
  version: number
  theme: MypaceStorage['theme']
  filters: MypaceStorage['filters']
}

export function exportSettings(): ExportableSettings {
  const data = readStorage()
  return {
    version: 3,
    theme: data.theme,
    filters: data.filters,
  }
}

export function importSettings(settings: ExportableSettings): void {
  const data = readStorage()
  if (settings.theme) {
    data.theme = { ...data.theme, ...settings.theme }
  }
  if (settings.filters) {
    const { presets, muteList, ...filterSettings } = settings.filters
    data.filters = {
      ...DEFAULT_SEARCH_FILTERS,
      ...filterSettings,
      presets: presets || [],
      muteList: muteList || [],
    }
  }
  writeStorage(data)
}

// ============ Migration ============

// Migrate from old multi-key structure to new single-key structure
export function migrateFromLegacy(): void {
  if (typeof localStorage === 'undefined') return

  // Check if already migrated
  if (localStorage.getItem(STORAGE_KEY)) return

  // Read old keys
  const oldSk = localStorage.getItem('mypace_sk') || ''
  const oldProfile = localStorage.getItem('mypace_profile')
  const oldThemeColors = localStorage.getItem('mypace_theme_colors')
  const oldAppTheme = localStorage.getItem('mypace_app_theme')
  const oldVimMode = localStorage.getItem('mypace_vim_mode')
  const oldDraft = localStorage.getItem('mypace_draft') || ''
  const oldDraftReplyTo = localStorage.getItem('mypace_draft_reply_to') || ''
  const oldSearchFilters = localStorage.getItem('mypace_search_filters')
  const oldFilterPresets = localStorage.getItem('mypace_filter_presets')
  const oldMuteList = localStorage.getItem('mypace_mute_list')

  // Build new structure
  const oldFilters = oldSearchFilters ? JSON.parse(oldSearchFilters) : {}
  const data: MypaceStorage = {
    theme: {
      mode: (oldAppTheme as 'light' | 'dark') || 'light',
      colors: oldThemeColors ? JSON.parse(oldThemeColors) : DEFAULT_COLORS,
    },
    filters: {
      ...DEFAULT_SEARCH_FILTERS,
      ...oldFilters,
      lang: oldFilters.lang || getDefaultLanguage(),
      presets: oldFilterPresets ? JSON.parse(oldFilterPresets) : [],
      muteList: oldMuteList ? JSON.parse(oldMuteList) : [],
    },
    auth: {
      sk: oldSk,
    },
    cache: {
      profile: oldProfile ? JSON.parse(oldProfile) : null,
    },
    editor: {
      vimMode: oldVimMode === 'true',
      draft: oldDraft,
      draftReplyTo: oldDraftReplyTo,
    },
  }

  // Write new structure
  writeStorage(data)

  // Remove old keys
  const oldKeys = [
    'mypace_sk',
    'mypace_profile',
    'mypace_theme_colors',
    'mypace_app_theme',
    'mypace_vim_mode',
    'mypace_draft',
    'mypace_draft_reply_to',
    'mypace_search_filters',
    'mypace_filter_presets',
    'mypace_mute_list',
    // Legacy keys
    'mypace_only',
    'mypace_language_filter',
    'mypace_ng_words',
  ]
  oldKeys.forEach((key) => localStorage.removeItem(key))
}

// Run migration on module load
migrateFromLegacy()
