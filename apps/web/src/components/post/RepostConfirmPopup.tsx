import { createPortal } from 'react-dom'
import { CloseButton } from '../ui'

interface RepostConfirmPopupProps {
  position: { top: number; left: number }
  onConfirm: () => void
  onClose: () => void
}

export default function RepostConfirmPopup({ position, onConfirm, onClose }: RepostConfirmPopupProps) {
  return createPortal(
    <>
      <div className="repost-confirm-overlay" onClick={onClose} />
      <div
        className="repost-confirm-popup"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="repost-confirm-header">
          <span className="repost-confirm-title">Repost?</span>
          <CloseButton onClick={onClose} size={16} />
        </div>
        <div className="repost-confirm-actions">
          <button className="repost-confirm-yes" onClick={onConfirm}>
            Yes
          </button>
          <button className="repost-confirm-no" onClick={onClose}>
            No
          </button>
        </div>
      </div>
    </>,
    document.body
  )
}
