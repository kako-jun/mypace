import { useState } from 'react'
import { Button, SettingsSection } from '../ui'
import {
  exportSettings as exportStorageSettings,
  importSettings as importStorageSettings,
  type ExportableSettings,
} from '../../lib/storage'

interface ExportSectionProps {
  onImport: () => void
}

interface SettingsJSON {
  mypace_settings: ExportableSettings
}

function parseSettings(json: string): ExportableSettings | null {
  try {
    const data = JSON.parse(json) as SettingsJSON
    if (!data.mypace_settings) return null
    return data.mypace_settings
  } catch {
    return null
  }
}

export default function ExportSection({ onImport }: ExportSectionProps) {
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleDownload = () => {
    const settings: SettingsJSON = {
      mypace_settings: exportStorageSettings(),
    }
    const json = JSON.stringify(settings, null, 2)
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
        importStorageSettings(settings)
        onImport()
        setMessage({ type: 'success', text: 'Settings imported' })
        setTimeout(() => setMessage(null), 2000)
      } else {
        setMessage({ type: 'error', text: 'Invalid settings file' })
        setTimeout(() => setMessage(null), 2000)
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to read file' })
      setTimeout(() => setMessage(null), 2000)
    }

    // Reset input
    e.target.value = ''
  }

  return (
    <SettingsSection title="Export / Import">
      <p className="hint">Transfer settings to other devices</p>

      <div className="export-buttons">
        <Button size="md" onClick={handleDownload}>
          Export
        </Button>
        <Button size="md" onClick={() => document.getElementById('settings-file-input')?.click()}>
          Import
        </Button>
        <input id="settings-file-input" type="file" accept=".json" onChange={handleFileSelect} hidden />
      </div>

      {message && <div className={`export-message ${message.type}`}>{message.text}</div>}
    </SettingsSection>
  )
}
