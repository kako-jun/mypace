import { TextButton } from '../ui'
import { LIMITS } from '../../lib/constants'

interface FormActionsProps {
  content: string
  posting: boolean
  showPreview: boolean
  onShowPreviewChange: (show: boolean) => void
  editingEvent?: { id: string } | null
  replyingTo?: { id: string } | null
  onCancel?: () => void
}

export function FormActions({
  content,
  posting,
  showPreview,
  onShowPreviewChange,
  editingEvent,
  replyingTo,
  onCancel,
}: FormActionsProps) {
  const isSpecialMode = editingEvent || replyingTo

  const getButtonText = () => {
    if (posting) {
      if (editingEvent) return 'Saving...'
      if (replyingTo) return 'Replying...'
      return 'Posting...'
    }
    if (editingEvent) return 'Save'
    if (replyingTo) return 'Reply'
    return 'Post'
  }

  return (
    <div className="post-actions">
      <div className="post-actions-left">
        <TextButton
          variant="primary"
          className={`preview-toggle ${showPreview ? 'active' : ''}`}
          onClick={() => onShowPreviewChange(!showPreview)}
        >
          {showPreview ? 'HIDE' : 'PREVIEW'}
        </TextButton>
        <span className={`char-count ${content.length > LIMITS.FOLD_THRESHOLD ? 'char-count-fold' : ''}`}>
          {content.length}/{LIMITS.MAX_POST_LENGTH}
          {content.length > LIMITS.FOLD_THRESHOLD && ' (folded)'}
        </span>
      </div>
      <div className="post-actions-right">
        {isSpecialMode && onCancel && (
          <button type="button" className="cancel-button" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="post-button" disabled={posting || !content.trim()}>
          {getButtonText()}
        </button>
      </div>
    </div>
  )
}
