import { createPortal } from 'react-dom'
import { CloseButton, TextButton } from '../ui'

interface RepostConfirmPopupProps {
  position: { top: number; left: number }
  onConfirm: () => void
  onClose: () => void
}

export default function RepostConfirmPopup({ position, onConfirm, onClose }: RepostConfirmPopupProps) {
  return createPortal(
    <>
      <div className="popup-overlay" onClick={onClose} />
      <div
        className="popup-panel repost-confirm-popup"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="popup-header">
          <span className="popup-title">Repost?</span>
          <CloseButton onClick={onClose} size={16} />
        </div>
        <div className="repost-confirm-actions">
          <TextButton variant="primary" onClick={onConfirm}>
            Yes
          </TextButton>
          <TextButton onClick={onClose}>No</TextButton>
        </div>
      </div>
    </>,
    document.body
  )
}
