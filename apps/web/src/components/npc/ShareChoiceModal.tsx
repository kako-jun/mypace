import { useNavigate } from 'react-router-dom'
import { createReporterQuote } from '../../lib/api'
import { useState } from 'react'

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
    <div className="share-choice-overlay" onClick={handleOverlayClick}>
      <div className="share-choice-modal">
        <div className="share-choice-title">シェア先を選択</div>
        <div className="share-choice-options">
          <button className="share-choice-btn" onClick={handleSelfPost} disabled={loading}>
            <span className="share-choice-btn-icon">✏️</span>
            <span className="share-choice-btn-title">自分で投稿</span>
            <span className="share-choice-btn-desc">URLを本文に埋め込んで編集</span>
          </button>
          <button className="share-choice-btn" onClick={handleReporterQuote} disabled={loading}>
            <span className="share-choice-btn-icon">📰</span>
            <span className="share-choice-btn-title">{loading ? '作成中...' : '記者に依頼'}</span>
            <span className="share-choice-btn-desc">記者に引用投稿を作らせる</span>
          </button>
        </div>
      </div>
    </div>
  )
}
