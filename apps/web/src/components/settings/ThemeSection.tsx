import { ColorPicker } from '../ui'
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
      <div className="settings-section">
        <h3>App Theme</h3>
        <div className="theme-switcher">
          <button
            className={`theme-btn ${appTheme === 'light' ? 'active' : ''}`}
            onClick={() => onAppThemeChange('light')}
          >
            LIGHT
          </button>
          <button
            className={`theme-btn ${appTheme === 'dark' ? 'active' : ''}`}
            onClick={() => onAppThemeChange('dark')}
          >
            DARK
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Window Color</h3>
        <p className="hint">Customize background with 4-corner gradient</p>

        <div
          className="theme-preview"
          style={{
            background: `radial-gradient(ellipse at top left, ${themeColors.topLeft}dd 0%, transparent 50%),
               radial-gradient(ellipse at top right, ${themeColors.topRight}dd 0%, transparent 50%),
               radial-gradient(ellipse at bottom left, ${themeColors.bottomLeft}dd 0%, transparent 50%),
               radial-gradient(ellipse at bottom right, ${themeColors.bottomRight}dd 0%, transparent 50%),
               linear-gradient(135deg, ${themeColors.topLeft} 0%, ${themeColors.bottomRight} 100%)`,
          }}
        >
          <div className="color-picker-grid">
            <div className="color-picker-corner top-left">
              <ColorPicker value={themeColors.topLeft} onChange={(color) => onColorChange('topLeft', color)} />
            </div>
            <div className="color-picker-corner top-right">
              <ColorPicker value={themeColors.topRight} onChange={(color) => onColorChange('topRight', color)} />
            </div>
            <div className="color-picker-corner bottom-left">
              <ColorPicker value={themeColors.bottomLeft} onChange={(color) => onColorChange('bottomLeft', color)} />
            </div>
            <div className="color-picker-corner bottom-right">
              <ColorPicker value={themeColors.bottomRight} onChange={(color) => onColorChange('bottomRight', color)} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
