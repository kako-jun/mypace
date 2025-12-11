interface DeleteConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmDialog({ onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div className="delete-confirm" role="dialog" aria-label="Confirm delete">
      <span className="delete-confirm-text">Delete?</span>
      <button className="delete-confirm-yes" onClick={onConfirm} aria-label="Confirm delete">
        Yes
      </button>
      <button className="delete-confirm-no" onClick={onCancel} aria-label="Cancel delete">
        No
      </button>
    </div>
  )
}
