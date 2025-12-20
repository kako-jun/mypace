import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PostView } from './post'
import { navigateBack } from '../lib/utils'

export function PostModal() {
  const { id } = useParams<{ id: string }>()

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        navigateBack()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  if (!id) {
    return null
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      navigateBack()
    }
  }

  return (
    <div className="post-modal-backdrop" onClick={handleBackdropClick}>
      <div className="post-modal-content">
        <PostView eventId={id} isModal onClose={navigateBack} />
      </div>
    </div>
  )
}
