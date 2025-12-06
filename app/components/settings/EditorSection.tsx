interface EditorSectionProps {
  vimMode: boolean
  onVimModeChange: (enabled: boolean) => void
}

export default function EditorSection({
  vimMode,
  onVimModeChange
}: EditorSectionProps) {
  return (
    <div class="settings-section">
      <h3>Editor</h3>
      <p class="hint">Long mode editor settings</p>
      <div class="vim-mode-toggle">
        <label class="toggle-label">
          <input
            type="checkbox"
            checked={vimMode}
            onChange={(e) => onVimModeChange((e.target as HTMLInputElement).checked)}
          />
          <span class="toggle-text">Vim mode</span>
        </label>
      </div>
    </div>
  )
}
