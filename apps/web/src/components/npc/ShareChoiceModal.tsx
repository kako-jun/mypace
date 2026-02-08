import { useNavigate } from 'react-router-dom'
import { createReporterQuote } from '../../lib/api'
import { useState } from 'react'
import { CloseButton, Icon } from '../ui'

interface ShareChoiceModalProps {
  isOpen: boolean
  onClose: () => void
  sharedUrl: string
  sharedText: string
}

export function ShareChoiceModal({ isOpen, onClose, sharedUrl, sharedText }: ShareChoiceModalProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  const handleSelfPost = () => {
    onClose()
    navigate(`/intent/post?text=${encodeURIComponent(sharedText)}`)
  }

  const handleReporterQuote = async () => {
    setLoading(true)
    try {
      const result = await createReporterQuote(sharedUrl)
      if (result.success && result.quote) {
        onClose()
        navigate(`/post/${result.quote.event.id}`)
      } else {
        // Fallback to self post if reporter fails
        handleSelfPost()
      }
    } catch {
      handleSelfPost()
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onClose()
    }
  }

  return (
    <div className="share-choice-backdrop" onClick={handleOverlayClick}>
      <div className="share-choice-popup">
        <div className="share-choice-header">
          <span className="share-choice-title">シェア先を選択</span>
          <CloseButton onClick={onClose} size={16} />
        </div>
        <div className="share-choice-options">
          <button className="share-choice-option" onClick={handleSelfPost} disabled={loading}>
            <Icon name="PenLine" size={16} />
            <span>自分で投稿</span>
            <Icon name="ChevronRight" size={16} />
          </button>
          <button className="share-choice-option" onClick={handleReporterQuote} disabled={loading}>
            <Icon name="Newspaper" size={16} />
            <span>{loading ? '作成中...' : '記者に依頼'}</span>
            <Icon name="ChevronRight" size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
