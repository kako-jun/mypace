import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchUploadHistory, deleteUploadFromHistory, type UploadHistoryItem } from '../lib/api'
import { copyToClipboard } from '../lib/utils'
import { getCurrentPubkey } from '../lib/nostr/events'
import { BackButton } from '../components/ui'
import '../styles/pages/upload-history.css'

export function UploadHistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<UploadHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [pubkey, setPubkey] = useState<string>('')

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const pk = await getCurrentPubkey()
        setPubkey(pk)
        const uploads = await fetchUploadHistory(pk)
        setHistory(uploads)
      } catch {
        // Failed to load
      } finally {
        setLoading(false)
      }
    }
    loadHistory()
  }, [])

  const handleCopyUrl = async (url: string) => {
    await copyToClipboard(url)
  }

  const handleRemove = async (url: string) => {
    if (!pubkey) return
    const success = await deleteUploadFromHistory(pubkey, url)
    if (success) {
      setHistory(history.filter((item) => item.url !== url))
    }
    setConfirmDelete(null)
  }

  const formatDate = (timestamp: number) => {
    // API returns Unix timestamp in seconds
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getTypeIcon = (type: UploadHistoryItem['type']) => {
    switch (type) {
      case 'image':
        return '🖼️'
      case 'video':
        return '🎬'
      case 'audio':
        return '🎵'
      default:
        return '📁'
    }
  }

  return (
    <div className="upload-history-page">
      <BackButton onClick={() => navigate(-1)} />

      <div className="upload-history-notice">
        <p>
          nostr.buildにアップロードしたファイルの履歴です。
          CopyでURLをコピーし、Deleteから削除ページでURLを貼り付けてください。
        </p>
      </div>

      {loading ? (
        <div className="upload-history-empty">
          <p>Loading...</p>
        </div>
      ) : history.length === 0 ? (
        <div className="upload-history-empty">
          <p>アップロード履歴がありません</p>
        </div>
      ) : (
        <div className="upload-history-list">
          {history.map((item) => (
            <div key={item.url} className="upload-history-item">
              <div className="upload-history-item-preview">
                {item.type === 'image' ? (
                  <img src={item.url} alt={item.filename} loading="lazy" />
                ) : (
                  <span className="upload-history-item-icon">{getTypeIcon(item.type)}</span>
                )}
              </div>

              <div className="upload-history-item-info">
                <div className="upload-history-item-filename">{item.filename}</div>
                <div className="upload-history-item-meta">
                  <span className="upload-history-item-type">{item.type}</span>
                  <span className="upload-history-item-date">{formatDate(item.uploadedAt)}</span>
                </div>
              </div>

              <div className="upload-history-item-actions">
                <button className="upload-history-copy-btn" onClick={() => handleCopyUrl(item.url)} title="Copy URL">
                  Copy
                </button>
                <a
                  href="https://nostr.build/delete/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="upload-history-delete-link"
                >
                  Delete
                </a>
                <button
                  className="upload-history-remove-btn"
                  onClick={() => setConfirmDelete(item.url)}
                  title="Remove from history"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <>
          <div className="upload-history-confirm-backdrop" onClick={() => setConfirmDelete(null)} />
          <div className="upload-history-confirm-dialog">
            <p>このURLを履歴から削除すると、nostr.buildからファイルを削除するための情報を失います。</p>
            <p className="upload-history-confirm-warning">本当に削除しますか？</p>
            <div className="upload-history-confirm-buttons">
              <button className="upload-history-confirm-cancel" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="upload-history-confirm-ok" onClick={() => handleRemove(confirmDelete)}>
                Remove
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
