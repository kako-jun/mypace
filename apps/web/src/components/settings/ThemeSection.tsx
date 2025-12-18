import { useState, useRef, useEffect } from 'react'
import { ColorPicker } from '../ui'
import type { ThemeColors } from '../../types'

interface ThemeSectionProps {
  appTheme: 'light' | 'dark'
  themeColors: ThemeColors
  onAppThemeChange: (theme: 'light' | 'dark') => void
  onColorChange: (corner: keyof ThemeColors, color: string) => void
}

type CornerKey = keyof ThemeColors

interface ColorMenuProps {
  corner: CornerKey
  color: string
  copiedColor: string | null
  position: 'left' | 'right'
  onCopy: () => void
  onApplyToAll: (color: string) => void
  onColorChange: (color: string) => void
}

function ColorMenu({ corner, color, copiedColor, position, onCopy, onApplyToAll, onColorChange }: ColorMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hexInput, setHexInput] = useState(color.toUpperCase())
  const menuRef = useRef<HTMLDivElement>(null)

  // Sync hexInput when color changes externally
  useEffect(() => {
    setHexInput(color.toUpperCase())
  }, [color])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const cornerLabels: Record<CornerKey, string> = {
    topLeft: '左上',
    topRight: '右上',
    bottomLeft: '左下',
    bottomRight: '右下',
  }

  const handleHexChange = (value: string) => {
    // Allow typing with or without #
    let hex = value.toUpperCase()
    if (!hex.startsWith('#')) {
      hex = '#' + hex
    }
    setHexInput(hex)

    // Validate and apply if valid hex (convert to lowercase for consistency)
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      onColorChange(hex.toLowerCase())
    }
  }

  const handleHexBlur = () => {
    // Reset to current color if invalid
    if (!/^#[0-9A-F]{6}$/i.test(hexInput)) {
      setHexInput(color.toUpperCase())
    }
  }

  return (
    <div className={`color-menu ${position}`} ref={menuRef}>
      <button
        className="color-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title={`${cornerLabels[corner]}の色メニュー`}
      >
        ⋮
      </button>
      {isOpen && (
        <div className={`color-menu-dropdown ${position}`}>
          <div className="color-menu-hex">
            <input
              type="text"
              value={hexInput}
              onChange={(e) => handleHexChange(e.target.value)}
              onBlur={handleHexBlur}
              maxLength={7}
              placeholder="#RRGGBB"
            />
            <div className="color-menu-preview" style={{ backgroundColor: color }} />
          </div>
          <button
            onClick={() => {
              onCopy()
              setIsOpen(false)
            }}
          >
            コピー
          </button>
          <button
            onClick={() => {
              if (copiedColor) {
                onColorChange(copiedColor)
              }
              setIsOpen(false)
            }}
            disabled={!copiedColor}
            className={!copiedColor ? 'disabled' : ''}
          >
            ペースト
          </button>
          <button
            onClick={() => {
              onApplyToAll(color)
              setIsOpen(false)
            }}
          >
            全隅に適用
          </button>
        </div>
      )}
    </div>
  )
}

export default function ThemeSection({ appTheme, themeColors, onAppThemeChange, onColorChange }: ThemeSectionProps) {
  const [copiedColor, setCopiedColor] = useState<string | null>(null)

  const handleCopy = (corner: CornerKey) => {
    setCopiedColor(themeColors[corner])
  }

  const handleApplyToAll = (color: string) => {
    onColorChange('topLeft', color)
    onColorChange('topRight', color)
    onColorChange('bottomLeft', color)
    onColorChange('bottomRight', color)
  }

  const renderCorner = (corner: CornerKey, position: 'left' | 'right') => {
    const menuPosition = position === 'left' ? 'left' : 'right'
    return (
      <div className={`color-picker-corner ${corner.replace(/([A-Z])/g, '-$1').toLowerCase()}`}>
        {position === 'left' && (
          <ColorMenu
            corner={corner}
            color={themeColors[corner]}
            copiedColor={copiedColor}
            position={menuPosition}
            onCopy={() => handleCopy(corner)}
            onApplyToAll={handleApplyToAll}
            onColorChange={(color) => onColorChange(corner, color)}
          />
        )}
        <ColorPicker value={themeColors[corner]} onChange={(color) => onColorChange(corner, color)} />
        {position === 'right' && (
          <ColorMenu
            corner={corner}
            color={themeColors[corner]}
            copiedColor={copiedColor}
            position={menuPosition}
            onCopy={() => handleCopy(corner)}
            onApplyToAll={handleApplyToAll}
            onColorChange={(color) => onColorChange(corner, color)}
          />
        )}
      </div>
    )
  }

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
            {renderCorner('topLeft', 'left')}
            {renderCorner('topRight', 'right')}
            {renderCorner('bottomLeft', 'left')}
            {renderCorner('bottomRight', 'right')}
          </div>
        </div>
      </div>
    </>
  )
}
