import { Button, ColorPicker } from '../ui'
import type { ThemeColors } from '../../types'

interface ThemeSectionProps {
  appTheme: 'light' | 'dark'
  themeColors: ThemeColors
  onAppThemeChange: (theme: 'light' | 'dark') => void
  onColorChange: (corner: keyof ThemeColors, color: string) => void
}

export default function ThemeSection({ appTheme, themeColors, onAppThemeChange, onColorChange }: ThemeSectionProps) {
  return (
    <>
      <div class="settings-section">
        <h3>App Theme</h3>
        <div class="theme-switcher">
          {appTheme === 'light' ? (
            <span class="theme-current">Light</span>
          ) : (
            <Button onClick={() => onAppThemeChange('light')}>Light</Button>
          )}
          {appTheme === 'dark' ? (
            <span class="theme-current">Dark</span>
          ) : (
            <Button onClick={() => onAppThemeChange('dark')}>Dark</Button>
          )}
        </div>
      </div>

      <div class="settings-section">
        <h3>Window Color</h3>
        <p class="hint">Customize background with 4-corner gradient</p>

        <div
          class="theme-preview"
          style={{
            background: `radial-gradient(ellipse at top left, ${themeColors.topLeft}dd 0%, transparent 50%),
               radial-gradient(ellipse at top right, ${themeColors.topRight}dd 0%, transparent 50%),
               radial-gradient(ellipse at bottom left, ${themeColors.bottomLeft}dd 0%, transparent 50%),
               radial-gradient(ellipse at bottom right, ${themeColors.bottomRight}dd 0%, transparent 50%),
               linear-gradient(135deg, ${themeColors.topLeft} 0%, ${themeColors.bottomRight} 100%)`,
          }}
        >
          <div class="color-picker-grid">
            <div class="color-picker-corner top-left">
              <ColorPicker value={themeColors.topLeft} onChange={(color) => onColorChange('topLeft', color)} />
            </div>
            <div class="color-picker-corner top-right">
              <ColorPicker value={themeColors.topRight} onChange={(color) => onColorChange('topRight', color)} />
            </div>
            <div class="color-picker-corner bottom-left">
              <ColorPicker value={themeColors.bottomLeft} onChange={(color) => onColorChange('bottomLeft', color)} />
            </div>
            <div class="color-picker-corner bottom-right">
              <ColorPicker value={themeColors.bottomRight} onChange={(color) => onColorChange('bottomRight', color)} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
