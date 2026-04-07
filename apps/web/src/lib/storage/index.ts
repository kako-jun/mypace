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
interface MypaceStorage {
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
    sk: string // legacy single key (migrated to keys[])
    keys: string[] // multiple hex secret keys (plaintext)
    activeIndex: number // which key is active
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
  pwa: {
    installDismissedAt: number | null
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
    keys: [],
    activeIndex: 0,
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
  pwa: {
    installDismissedAt: null,
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
        auth: (() => {
          const a = { ...DEFAULT_STORAGE.auth, ...parsed.auth }
          // Migrate: auth.sk (single) → auth.keys[] (multi)
          // Note: auth.sk may be encrypted (enc: prefix) from session 63.
          // initSecretKeyCache() handles decryption and migration.
          if ((!a.keys || a.keys.length === 0) && a.sk && !a.sk.startsWith('enc:')) {
            a.keys = [a.sk]
            a.activeIndex = 0
          }
          // Clamp activeIndex
          if (a.keys && a.keys.length > 0) {
            a.activeIndex = Math.min(a.activeIndex || 0, a.keys.length - 1)
          }
          return a
        })(),
        cache: { ...DEFAULT_STORAGE.cache, ...parsed.cache },
        editor: { ...DEFAULT_STORAGE.editor, ...parsed.editor },
        pwa: { ...DEFAULT_STORAGE.pwa, ...parsed.pwa },
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

import { encryptSecret, decryptSecret, isEncrypted } from './crypto'

// In-memory cache: decrypted keys (avoids async crypto on every read)
let _keysCache: string[] | null = null
let _activeIndexCache = 0

/**
 * Initialize secret key cache by decrypting stored keys.
 * Must be called once at app startup (before any getSecretKey calls).
 */
export async function initSecretKeyCache(): Promise<void> {
  const data = readStorage()
  const { keys, activeIndex, sk } = data.auth

  // Case 1: keys[] already exists (may be encrypted or plaintext)
  if (keys && keys.length > 0) {
    const decrypted: string[] = []
    let needsRewrite = false
    for (const k of keys) {
      if (isEncrypted(k)) {
        const d = await decryptSecret(k)
        decrypted.push(d)
      } else if (k) {
        decrypted.push(k)
        needsRewrite = true // plaintext found, will re-encrypt
      }
    }
    _keysCache = decrypted.filter((k) => k.length > 0)
    _activeIndexCache = Math.min(activeIndex || 0, Math.max(_keysCache.length - 1, 0))

    // Re-encrypt any plaintext keys
    if (needsRewrite && _keysCache.length > 0) {
      const encrypted = await Promise.all(_keysCache.map((k) => encryptSecret(k)))
      updateStorage('auth', (a) => ({
        ...a,
        keys: encrypted,
        activeIndex: _activeIndexCache,
        sk: encrypted[_activeIndexCache] || '',
      }))
    }
    return
  }

  // Case 2: legacy auth.sk only (encrypted or plaintext)
  if (sk) {
    const decrypted = isEncrypted(sk) ? await decryptSecret(sk) : sk
    if (decrypted) {
      _keysCache = [decrypted]
      _activeIndexCache = 0
      const encrypted = await encryptSecret(decrypted)
      updateStorage('auth', (a) => ({
        ...a,
        sk: encrypted,
        keys: [encrypted],
        activeIndex: 0,
      }))
    } else {
      _keysCache = []
      _activeIndexCache = 0
      updateStorage('auth', (a) => ({ ...a, sk: '', keys: [], activeIndex: 0 }))
    }
    return
  }

  // Case 3: legacy localStorage key
  if (typeof localStorage !== 'undefined') {
    const legacySk = localStorage.getItem(LEGACY_SK_KEY)
    if (legacySk) {
      _keysCache = [legacySk]
      _activeIndexCache = 0
      const encrypted = await encryptSecret(legacySk)
      updateStorage('auth', (a) => ({
        ...a,
        sk: encrypted,
        keys: [encrypted],
        activeIndex: 0,
      }))
      localStorage.removeItem(LEGACY_SK_KEY)
      return
    }
  }

  // No keys at all
  _keysCache = []
  _activeIndexCache = 0
}

/**
 * Get the active secret key (synchronous, uses cache).
 */
export function getSecretKey(): string {
  if (_keysCache !== null && _keysCache.length > 0) {
    return _keysCache[_activeIndexCache] || ''
  }
  // Cache not yet populated — try synchronous read of plaintext
  const data = readStorage()
  const { keys, activeIndex, sk } = data.auth
  if (keys && keys.length > 0) {
    // Find the first non-encrypted key (encrypted ones need initSecretKeyCache)
    const idx = Math.min(activeIndex || 0, keys.length - 1)
    if (!isEncrypted(keys[idx])) return keys[idx]
  }
  if (sk && !isEncrypted(sk)) return sk
  return ''
}

export async function setSecretKey(sk: string): Promise<void> {
  // Update in-memory cache synchronously (before async encryption)
  // so that getSecretKey() returns the new value immediately.
  if (_keysCache) {
    const idx = Math.min(_activeIndexCache, Math.max(_keysCache.length - 1, 0))
    if (_keysCache.length === 0) {
      _keysCache.push(sk)
    } else {
      _keysCache[idx] = sk
    }
  }
  // Encrypt and persist asynchronously
  const encrypted = await encryptSecret(sk)
  updateStorage('auth', (a) => {
    const keys = [...(a.keys || [])]
    const idx = Math.min(a.activeIndex || 0, Math.max(keys.length - 1, 0))
    if (keys.length === 0) {
      keys.push(encrypted)
    } else {
      keys[idx] = encrypted
    }
    return { ...a, sk: encrypted, keys, activeIndex: idx }
  })
}

export function clearSecretKey(): void {
  // Update cache first, then persist (Bug 1 fix: consistent order)
  if (_keysCache) {
    const idx = _activeIndexCache
    if (idx < _keysCache.length) {
      _keysCache.splice(idx, 1)
    }
    _activeIndexCache = Math.min(idx, Math.max(_keysCache.length - 1, 0))
  }
  updateStorage('auth', (a) => {
    const keys = [...(a.keys || [])]
    const idx = a.activeIndex || 0
    if (keys.length > 0 && idx < keys.length) {
      keys.splice(idx, 1)
    }
    const newIndex = Math.min(idx, Math.max(keys.length - 1, 0))
    return { ...a, sk: keys[newIndex] || '', keys, activeIndex: newIndex }
  })
}

export function removeSecretKeyByIndex(index: number): void {
  // Update cache first, then persist
  if (_keysCache && index >= 0 && index < _keysCache.length) {
    _keysCache.splice(index, 1)
    if (_activeIndexCache >= _keysCache.length) {
      _activeIndexCache = Math.max(_keysCache.length - 1, 0)
    } else if (_activeIndexCache > index) {
      _activeIndexCache--
    }
  }
  updateStorage('auth', (a) => {
    const keys = [...(a.keys || [])]
    if (index >= 0 && index < keys.length) {
      keys.splice(index, 1)
    }
    let newIndex = a.activeIndex || 0
    if (newIndex >= keys.length) {
      newIndex = Math.max(keys.length - 1, 0)
    } else if (newIndex > index) {
      newIndex--
    }
    return { ...a, sk: keys[newIndex] || '', keys, activeIndex: newIndex }
  })
}

// Multi-key management

export function getAllSecretKeys(): string[] {
  return _keysCache || []
}

export function getActiveKeyIndex(): number {
  return _activeIndexCache
}

export async function addSecretKey(sk: string): Promise<number> {
  // Initialize cache if not yet populated
  if (_keysCache === null) {
    _keysCache = []
    _activeIndexCache = 0
  }

  // Check if already exists in cache (dedup)
  const existing = _keysCache.indexOf(sk)
  if (existing >= 0) {
    _activeIndexCache = existing
    updateStorage('auth', (a) => {
      const keys = a.keys || []
      return { ...a, sk: keys[existing] || '', activeIndex: existing }
    })
    return existing
  }

  // Add to cache synchronously
  _keysCache.push(sk)
  _activeIndexCache = _keysCache.length - 1

  // Encrypt and persist
  const encrypted = await encryptSecret(sk)
  updateStorage('auth', (a) => {
    const keys = [...(a.keys || [])]
    keys.push(encrypted)
    const newIndex = keys.length - 1
    return { ...a, sk: encrypted, keys, activeIndex: newIndex }
  })
  return _activeIndexCache
}

export function switchSecretKey(index: number): void {
  const clamp = (i: number, len: number) => Math.max(0, Math.min(i, len - 1))
  if (_keysCache) {
    _activeIndexCache = clamp(index, _keysCache.length)
  }
  updateStorage('auth', (a) => {
    const keys = a.keys || []
    const idx = clamp(index, keys.length)
    return { ...a, sk: keys[idx] || '', activeIndex: idx }
  })
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

// ============ PWA ============

export function getPWAInstallDismissedAt(): number | null {
  return readStorage().pwa.installDismissedAt
}

export function setPWAInstallDismissedAt(timestamp: number | null): void {
  updateStorage('pwa', (p) => ({ ...p, installDismissedAt: timestamp }))
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
function migrateFromLegacy(): void {
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
      keys: oldSk ? [oldSk] : [],
      activeIndex: 0,
      useNip07: false,
    },
    cache: {
      profile: oldProfile ? JSON.parse(oldProfile) : null,
    },
    editor: {
      vimMode: oldVimMode === 'true',
      draft: oldDraft,
      draftReplyTo: oldDraftReplyTo,
    },
    pwa: {
      installDismissedAt: null,
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
