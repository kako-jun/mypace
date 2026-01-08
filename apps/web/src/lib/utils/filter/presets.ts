// Filter presets management
import { getFilterPresets, setFilterPresets } from '../../storage'
import type { FilterPreset, SearchFilters } from '../../../types'

export const MAX_PRESETS = 10

// Generate UUID for preset ID
function generateId(): string {
  return crypto.randomUUID()
}

// Load all presets from storage
export function loadPresets(): FilterPreset[] {
  return getFilterPresets()
}

// Save presets to storage
function savePresets(presets: FilterPreset[]): void {
  setFilterPresets(presets)
}

// Save a new preset (or update if same name exists)
export function savePreset(name: string, filters: SearchFilters): FilterPreset | null {
  const presets = loadPresets()
  const trimmedName = name.trim() || 'Untitled'

  // Check if preset with same name exists
  const existingIndex = presets.findIndex((p) => p.name === trimmedName)

  if (existingIndex !== -1) {
    // Update existing preset
    presets[existingIndex] = {
      ...presets[existingIndex],
      filters: { ...filters },
    }
    savePresets(presets)
    return presets[existingIndex]
  }

  // Check max limit for new preset
  if (presets.length >= MAX_PRESETS) {
    return null
  }

  const newPreset: FilterPreset = {
    id: generateId(),
    name: trimmedName,
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
