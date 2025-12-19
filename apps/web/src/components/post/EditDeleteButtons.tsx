import { TextButton } from '../ui'
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
      <TextButton variant="primary" className="edit-button" onClick={onEdit} aria-label="Edit this post">
        EDIT
      </TextButton>
      <TextButton variant="warning" className="delete-button" onClick={onDelete} aria-label="Delete this post">
        DELETE
      </TextButton>
    </>
  )
}
