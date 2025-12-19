// Filter presets management
import { STORAGE_KEYS } from '../constants'
import type { FilterPreset, SearchFilters } from '../../types'

export const MAX_PRESETS = 10

// Generate UUID for preset ID
function generateId(): string {
  return crypto.randomUUID()
}

// Load all presets from localStorage
export function loadPresets(): FilterPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.FILTER_PRESETS)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        return parsed
      }
    }
  } catch {
    // Ignore parse errors
  }
  return []
}

// Save presets to localStorage
function savePresets(presets: FilterPreset[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FILTER_PRESETS, JSON.stringify(presets))
  } catch {
    // Ignore storage errors
  }
}

// Save a new preset
export function savePreset(name: string, filters: SearchFilters): FilterPreset | null {
  const presets = loadPresets()

  // Check max limit
  if (presets.length >= MAX_PRESETS) {
    return null
  }

  const newPreset: FilterPreset = {
    id: generateId(),
    name: name.trim() || 'Untitled',
    filters: { ...filters },
    createdAt: Date.now(),
  }

  presets.push(newPreset)
  savePresets(presets)

  return newPreset
}

// Delete a preset by ID
export function deletePreset(id: string): boolean {
  const presets = loadPresets()
  const index = presets.findIndex((p) => p.id === id)

  if (index === -1) {
    return false
  }

  presets.splice(index, 1)
  savePresets(presets)

  return true
}

// Update a preset
export function updatePreset(id: string, updates: Partial<Omit<FilterPreset, 'id' | 'createdAt'>>): boolean {
  const presets = loadPresets()
  const index = presets.findIndex((p) => p.id === id)

  if (index === -1) {
    return false
  }

  presets[index] = {
    ...presets[index],
    ...updates,
  }
  savePresets(presets)

  return true
}

// Get a preset by ID
export function getPreset(id: string): FilterPreset | null {
  const presets = loadPresets()
  return presets.find((p) => p.id === id) || null
}
