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
    <div className="npc-modal-overlay" onClick={handleOverlayClick}>
      <div className="npc-modal">
        <div className="npc-modal-header">
          <span className="npc-modal-title">シェア先を選択</span>
          <CloseButton onClick={onClose} />
        </div>
        <div className="npc-modal-content">
          <div className="npc-list">
            <button className={`npc-item${loading ? ' npc-item-disabled' : ''}`} onClick={handleSelfPost} disabled={loading}>
              <span className="npc-item-icon"><Icon name="PenLine" size={20} /></span>
              <div className="npc-item-info">
                <span className="npc-item-name">自分で投稿</span>
                <span className="npc-item-desc">URLを本文に埋め込んで編集</span>
              </div>
              <Icon name="ChevronRight" size={18} className="npc-item-arrow" />
            </button>
            <button className={`npc-item${loading ? ' npc-item-disabled' : ''}`} onClick={handleReporterQuote} disabled={loading}>
              <span className="npc-item-icon"><Icon name="Newspaper" size={20} /></span>
              <div className="npc-item-info">
                <span className="npc-item-name">{loading ? '作成中...' : '記者に依頼'}</span>
                <span className="npc-item-desc">記者に引用投稿を作らせる</span>
              </div>
              <Icon name="ChevronRight" size={18} className="npc-item-arrow" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
