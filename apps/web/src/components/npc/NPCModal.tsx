import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../ui'
import { createReporterQuote } from '../../lib/api'

interface NPCModalProps {
  isOpen: boolean
  onClose: () => void
  initialUrl?: string
}

type ModalView = 'select' | 'reporter'

export function NPCModal({ isOpen, onClose, initialUrl = '' }: NPCModalProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<ModalView>(initialUrl ? 'reporter' : 'select')
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!isOpen) return null

  const handleReporterSelect = () => {
    setView('reporter')
    setError('')
  }

  const handleBack = () => {
    setView('select')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError('URLを入力してください')
      return
    }

    // Basic URL validation
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        setError('http:// または https:// で始まるURLを入力してください')
        return
      }
    } catch {
      setError('有効なURLを入力してください')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await createReporterQuote(url)
      if (result.success && result.quote) {
        // Navigate to the created quote post
        onClose()
        navigate(`/post/${result.quote.event.id}`)
      } else {
        setError(result.error || '引用投稿の作成に失敗しました')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="npc-modal-overlay" onClick={handleOverlayClick}>
      <div className="npc-modal">
        <div className="npc-modal-header">
          {view === 'reporter' ? (
            <>
              <button className="npc-modal-back" onClick={handleBack} aria-label="戻る">
                <Icon name="ArrowLeft" size={18} />
              </button>
              <span className="npc-modal-title">記者に依頼</span>
            </>
          ) : (
            <span className="npc-modal-title">NPCに依頼</span>
          )}
          <button className="npc-modal-close" onClick={onClose} aria-label="閉じる">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="npc-modal-content">
          {view === 'select' ? (
            <div className="npc-list">
              <button className="npc-item" onClick={handleReporterSelect}>
                <Icon name="Newspaper" size={16} />
                <span>記者</span>
                <Icon name="ChevronRight" size={16} />
              </button>
              <button className="npc-item" disabled>
                <Icon name="RefreshCw" size={16} />
                <span>スプレッダー</span>
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="npc-reporter-form">
              <label className="npc-form-label">引用させたいURLを入力:</label>
              <input
                type="url"
                className="npc-form-input"
                placeholder="https://"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                autoFocus
                disabled={loading}
              />
              {error && <div className="npc-form-error">{error}</div>}
              <button type="submit" className="npc-form-submit" disabled={loading || !url.trim()}>
                {loading ? '作成中...' : '引用させる'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
