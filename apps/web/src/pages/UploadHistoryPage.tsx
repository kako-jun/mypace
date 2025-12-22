import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getUploadHistory, removeUploadFromHistory, type UploadHistoryItem, copyToClipboard } from '../lib/utils'
import '../styles/pages/upload-history.css'

export function UploadHistoryPage() {
  const [history, setHistory] = useState<UploadHistoryItem[]>([])

  useEffect(() => {
    setHistory(getUploadHistory())
  }, [])

  const handleRemove = (url: string) => {
    removeUploadFromHistory(url)
    setHistory(getUploadHistory())
  }

  const handleCopyUrl = async (url: string) => {
    await copyToClipboard(url)
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
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
      <div className="upload-history-header">
        <Link to="/" className="upload-history-back">
          ← Back
        </Link>
        <h1>Upload History</h1>
      </div>

      <div className="upload-history-notice">
        <p>
          nostr.buildにアップロードしたファイルの履歴です。
          CopyでURLをコピーし、Deleteから削除ページでURLを貼り付けてください。
        </p>
        <p className="upload-history-notice-small">
          ※ ×ボタンはこのリストから削除するだけで、nostr.build上のファイルは消えません。
        </p>
      </div>

      {history.length === 0 ? (
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
                  onClick={() => handleRemove(item.url)}
                  title="Remove from list"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
