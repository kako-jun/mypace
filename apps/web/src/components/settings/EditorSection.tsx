import { Toggle } from '../ui'

interface EditorSectionProps {
  vimMode: boolean
  onVimModeChange: (enabled: boolean) => void
}

export default function EditorSection({ vimMode, onVimModeChange }: EditorSectionProps) {
  return (
    <div className="settings-section">
      <h3>Editor</h3>
      <p className="hint">Long mode editor settings</p>
      <div className="vim-mode-toggle">
        <Toggle checked={vimMode} onChange={onVimModeChange} label="Vim mode" />
      </div>
    </div>
  )
}
