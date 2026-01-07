import { createPortal } from 'react-dom'
import { CloseButton, TextButton } from '../ui'

interface DeleteConfirmDialogProps {
  position: { top: number; left: number }
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmDialog({ position, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return createPortal(
    <>
      <div className="delete-confirm-overlay" onClick={onCancel} />
      <div
        className="delete-confirm-popup"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="delete-confirm-header">
          <span className="delete-confirm-title">Delete?</span>
          <CloseButton onClick={onCancel} size={16} />
        </div>
        <div className="delete-confirm-actions">
          <TextButton variant="warning" onClick={onConfirm}>
            Yes
          </TextButton>
          <TextButton onClick={onCancel}>No</TextButton>
        </div>
      </div>
    </>,
    document.body
  )
}
