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
      <button class="edit-button text-outlined-sm" onClick={onEdit} aria-label="Edit this post">
        Edit
      </button>
      <button class="delete-button text-outlined-danger" onClick={onDelete} aria-label="Delete this post">
        Delete
      </button>
    </>
  )
}
