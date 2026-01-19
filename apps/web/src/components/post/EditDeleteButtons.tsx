import { useRef, useState, useEffect } from 'react'
import { TextButton } from '../ui'
import DeleteConfirmDialog from './DeleteConfirmDialog'
import '../../styles/components/edit-delete.css'

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
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null)

  // Calculate popup position when confirming
  useEffect(() => {
    if (isConfirming && deleteButtonRef.current) {
      const rect = deleteButtonRef.current.getBoundingClientRect()
      setPopupPosition({
        top: rect.top,
        left: rect.left + rect.width / 2,
      })
      // Close popup on scroll
      const handleScroll = () => onDeleteCancel()
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    } else {
      setPopupPosition(null)
    }
  }, [isConfirming, onDeleteCancel])

  return (
    <div className="edit-delete-wrapper">
      <TextButton variant="primary" className="edit-button" onClick={onEdit} aria-label="Edit this post">
        EDIT
      </TextButton>
      <TextButton
        variant="warning"
        className="delete-button"
        onClick={onDelete}
        aria-label="Delete this post"
        ref={deleteButtonRef}
      >
        DELETE
      </TextButton>
      {isConfirming && popupPosition && (
        <DeleteConfirmDialog position={popupPosition} onConfirm={onDeleteConfirm} onCancel={onDeleteCancel} />
      )}
    </div>
  )
}
