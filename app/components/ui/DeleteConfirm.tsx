interface DeleteConfirmProps {
  onConfirm: () => void
  onCancel: () => void
  message?: string
}

export default function DeleteConfirm({
  onConfirm,
  onCancel,
  message = 'Delete?',
}: DeleteConfirmProps) {
  return (
    <div class="delete-confirm">
      <span class="delete-confirm-text">{message}</span>
      <button class="delete-confirm-yes" onClick={onConfirm}>Yes</button>
      <button class="delete-confirm-no" onClick={onCancel}>No</button>
    </div>
  )
}
