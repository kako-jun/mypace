import { useState } from 'react'
import { loadPresets, loadMuteList, type MuteEntry } from '../../lib/utils'
import { Button } from '../ui'
import type { ThemeColors, FilterPreset } from '../../types'

interface ExportSectionProps {
  themeColors: ThemeColors
  appTheme: 'light' | 'dark'
  onImport: (settings: ImportedSettings) => void
}

export interface ImportedSettings {
  themeColors?: ThemeColors
  appTheme?: 'light' | 'dark'
  filterPresets?: FilterPreset[]
  muteList?: MuteEntry[]
}

interface SettingsJSON {
  mypace_settings: {
    version: number
    theme: {
      mode: 'light' | 'dark'
      colors: ThemeColors
    }
    filters?: {
      presets: FilterPreset[]
      muteList: MuteEntry[]
    }
  }
}

function exportSettings(themeColors: ThemeColors, appTheme: 'light' | 'dark'): string {
  const settings: SettingsJSON = {
    mypace_settings: {
      version: 2, // Bumped to version 2 for filter support
      theme: {
        mode: appTheme,
        colors: themeColors,
      },
      filters: {
        presets: loadPresets(),
        muteList: loadMuteList(),
      },
    },
  }
  return JSON.stringify(settings, null, 2)
}

function parseSettings(json: string): ImportedSettings | null {
  try {
    const data = JSON.parse(json) as SettingsJSON
    if (!data.mypace_settings) return null

    const settings = data.mypace_settings
    const result: ImportedSettings = {}

    if (settings.theme) {
      if (settings.theme.colors) {
        result.themeColors = settings.theme.colors
      }
      if (settings.theme.mode === 'light' || settings.theme.mode === 'dark') {
        result.appTheme = settings.theme.mode
      }
    }

    // Parse filter settings (version 2+)
    if (settings.filters) {
      if (Array.isArray(settings.filters.presets)) {
        result.filterPresets = settings.filters.presets
      }
      if (Array.isArray(settings.filters.muteList)) {
        result.muteList = settings.filters.muteList
      }
    }

    return result
  } catch {
    return null
  }
}

export default function ExportSection({ themeColors, appTheme, onImport }: ExportSectionProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleDownload = () => {
    const json = exportSettings(themeColors, appTheme)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mypace-settings.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const settings = parseSettings(text)
      if (settings) {
        onImport(settings)
        setMessage({ type: 'success', text: '設定を読み込みました' })
        setTimeout(() => setMessage(null), 2000)
      } else {
        setMessage({ type: 'error', text: '無効な設定ファイルです' })
        setTimeout(() => setMessage(null), 2000)
      }
    } catch {
      setMessage({ type: 'error', text: 'ファイルの読み込みに失敗しました' })
      setTimeout(() => setMessage(null), 2000)
    }

    // Reset input
    e.target.value = ''
  }

  return (
    <div className="settings-section">
      <h3>Export / Import</h3>
      <p className="hint">設定を他のデバイスに移行</p>

      <div className="export-buttons">
        <Button size="sm" onClick={handleDownload}>
          ファイルで保存
        </Button>
        <Button size="sm" variant="secondary" onClick={() => document.getElementById('settings-file-input')?.click()}>
          ファイルから読み込み
        </Button>
        <input id="settings-file-input" type="file" accept=".json" onChange={handleFileSelect} hidden />
      </div>

      {message && <div className={`export-message ${message.type}`}>{message.text}</div>}
    </div>
  )
}
