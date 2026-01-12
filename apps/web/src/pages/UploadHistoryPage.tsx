import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchUploadHistory, deleteUploadFromHistory, deleteFromNostrBuild, type UploadHistoryItem } from '../lib/api'
import { copyToClipboard } from '../lib/utils'
import { getCurrentPubkey } from '../lib/nostr/events'
import { BackButton, CopyButton, TextButton, CloseButton, LightBox, triggerLightBox, Icon } from '../components/ui'
import { formatTimestamp, getStoredThemeColors, isDarkColor } from '../lib/nostr/events'
import { TIMEOUTS } from '../lib/constants'
import '../styles/pages/upload-history.css'

function useTextClass(): string {
  const colors = getStoredThemeColors()
  if (!colors) return ''

  const darkCount =
    (isDarkColor(colors.topLeft) ? 1 : 0) +
    (isDarkColor(colors.topRight) ? 1 : 0) +
    (isDarkColor(colors.bottomLeft) ? 1 : 0) +
    (isDarkColor(colors.bottomRight) ? 1 : 0)

  return darkCount >= 2 ? 'light-text' : 'dark-text'
}

export function UploadHistoryPage() {
  const navigate = useNavigate()
  const [history, setHistory] = useState<UploadHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  const [pubkey, setPubkey] = useState<string>('')
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const textClass = useTextClass()

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
    const success = await copyToClipboard(url)
    if (success) {
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), TIMEOUTS.COPY_FEEDBACK)
    }
  }

  const handleRemoveFromHistory = async (url: string) => {
    if (!pubkey) return
    const success = await deleteUploadFromHistory(pubkey, url)
    if (success) {
      setHistory(history.filter((item) => item.url !== url))
    }
    setConfirmDelete(null)
  }

  const handleDeleteFromNostrBuild = async (url: string) => {
    setDeleting(url)
    setDeleteMessage(null)

    const result = await deleteFromNostrBuild(url)

    if (result.success) {
      // Remove from history
      if (pubkey) {
        await deleteUploadFromHistory(pubkey, url)
      }
      setHistory(history.filter((item) => item.url !== url))
      setDeleteMessage('Deleted (cache may take a few minutes to clear)')
    } else {
      setDeleteMessage(`Error: ${result.error || 'Failed to delete'}`)
    }

    setDeleting(null)
  }

  const getTypeIcon = (type: UploadHistoryItem['type']) => {
    switch (type) {
      case 'image':
        return <Icon name="Image" size={24} />
      case 'video':
        return <Icon name="Film" size={24} />
      case 'audio':
        return <Icon name="Music" size={24} />
      default:
        return <Icon name="File" size={24} />
    }
  }

  return (
    <div className="upload-history-page">
      <BackButton onClick={() => navigate(-1)} />

      <p className={`upload-history-hint themed-card ${textClass}`}>
        Files uploaded to nostr.build. Press DELETE to remove from server.
      </p>
      {deleteMessage && <p className={`upload-history-message themed-card ${textClass}`}>{deleteMessage}</p>}

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
              <CloseButton onClick={() => setConfirmDelete(item.url)} size={16} className="upload-history-remove-btn" />
              <div
                className={`upload-history-item-preview ${item.type === 'image' ? 'clickable' : ''}`}
                onClick={item.type === 'image' ? () => triggerLightBox(item.url) : undefined}
              >
                {item.type === 'image' ? (
                  <img src={item.url} alt={item.filename} loading="lazy" />
                ) : (
                  <span className="upload-history-item-icon">{getTypeIcon(item.type)}</span>
                )}
              </div>

              <div className="upload-history-item-info">
                <div className="upload-history-item-filename">{item.filename}</div>
                <div className="upload-history-url-row">
                  <div className="upload-history-url-scroll">
                    <span className="upload-history-url-text">{item.url}</span>
                  </div>
                  <CopyButton
                    copied={copiedUrl === item.url}
                    onClick={() => handleCopyUrl(item.url)}
                    className="upload-history-copy-btn"
                    aria-label="Copy URL"
                  />
                </div>
                <div className="upload-history-item-meta">
                  <span className="upload-history-item-type">{item.type}</span>
                  <span className="upload-history-item-date">{formatTimestamp(item.uploadedAt)}</span>
                </div>
              </div>

              <div className="upload-history-item-actions">
                <TextButton
                  variant="warning"
                  onClick={() => handleDeleteFromNostrBuild(item.url)}
                  disabled={deleting === item.url}
                  title="Delete from nostr.build"
                >
                  {deleting === item.url ? '...' : 'DELETE'}
                </TextButton>
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
              <button className="upload-history-confirm-ok" onClick={() => handleRemoveFromHistory(confirmDelete)}>
                Remove
              </button>
            </div>
          </div>
        </>
      )}
      <LightBox />
    </div>
  )
}
