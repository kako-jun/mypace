import DeleteConfirmDialog from './DeleteConfirmDialog'

interface EditDeleteButtonsProps {
  isConfirming: boolean
  onEdit: () => void
  onDelete: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}

export default function EditDeleteButtons({
  isConfirming,
  onEdit,
  onDelete,
  onDeleteConfirm,
  onDeleteCancel,
}: EditDeleteButtonsProps) {
  if (isConfirming) {
    return <DeleteConfirmDialog onConfirm={onDeleteConfirm} onCancel={onDeleteCancel} />
  }

  return (
    <>
      <button
        className="edit-button text-outlined text-outlined-button text-outlined-primary"
        onClick={onEdit}
        aria-label="Edit this post"
      >
        EDIT
      </button>
      <button
        className="delete-button text-outlined text-outlined-button text-outlined-warning"
        onClick={onDelete}
        aria-label="Delete this post"
      >
        DELETE
      </button>
    </>
  )
}
