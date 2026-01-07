import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon, CloseButton } from '../ui'

export type ShareOption = 'url' | 'md-copy' | 'md-download' | 'md-open'

interface ShareMenuProps {
  position: { top: number; left: number }
  onSelect: (option: ShareOption) => void
  onClose: (e?: React.MouseEvent) => void
}

export default function ShareMenu({ position, onSelect, onClose }: ShareMenuProps) {
  const [showContentMenu, setShowContentMenu] = useState(false)

  const handleSelect = (option: ShareOption) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelect(option)
  }

  const handleShowContentMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowContentMenu(true)
  }

  const handleBack = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowContentMenu(false)
  }

  return createPortal(
    <>
      <div className="share-menu-overlay" onClick={onClose} />
      <div
        className="share-menu"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {!showContentMenu ? (
          <>
            <div className="share-menu-header">
              <span className="share-menu-title">Share</span>
              <CloseButton onClick={() => onClose()} size={16} />
            </div>
            <div className="share-menu-options">
              <button className="share-menu-option" onClick={handleSelect('url')}>
                <Icon name="Link" size={16} />
                <span>Share URL</span>
              </button>
              <button className="share-menu-option" onClick={handleShowContentMenu}>
                <Icon name="FileText" size={16} />
                <span>Share Content</span>
                <Icon name="ChevronRight" size={16} className="share-menu-arrow" />
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="share-menu-header">
              <button className="share-menu-back" onClick={handleBack}>
                <Icon name="ChevronLeft" size={16} />
              </button>
              <span className="share-menu-title">Content</span>
              <CloseButton onClick={() => onClose()} size={16} />
            </div>
            <div className="share-menu-options">
              <button className="share-menu-option" onClick={handleSelect('md-copy')}>
                <Icon name="Clipboard" size={16} />
                <span>Copy Markdown</span>
              </button>
              <button className="share-menu-option" onClick={handleSelect('md-open')}>
                <Icon name="ExternalLink" size={16} />
                <span>Open Markdown URL</span>
              </button>
              <button className="share-menu-option" onClick={handleSelect('md-download')}>
                <Icon name="Download" size={16} />
                <span>Download Markdown</span>
              </button>
            </div>
          </>
        )}
      </div>
    </>,
    document.getElementById('popup-container') || document.body
  )
}
