interface DeleteConfirmDialogProps {
  onConfirm: () => void
  onCancel: () => void
}

export default function DeleteConfirmDialog({ onConfirm, onCancel }: DeleteConfirmDialogProps) {
  return (
    <div class="delete-confirm" role="dialog" aria-label="Confirm delete">
      <span class="delete-confirm-text">Delete?</span>
      <button class="delete-confirm-yes" onClick={onConfirm} aria-label="Confirm delete">
        Yes
      </button>
      <button class="delete-confirm-no" onClick={onCancel} aria-label="Cancel delete">
        No
      </button>
    </div>
  )
}
