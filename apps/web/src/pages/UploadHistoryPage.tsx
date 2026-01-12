import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchUploadHistory, deleteUploadFromHistory, deleteFromNostrBuild, type UploadHistoryItem } from '../lib/api'
import { copyToClipboard } from '../lib/utils'
import { getCurrentPubkey } from '../lib/nostr/events'
import { BackButton, CopyButton, TextButton, CloseButton, LightBox, triggerLightBox, Icon } from '../components/ui'
import DeleteConfirmDialog from '../components/post/DeleteConfirmDialog'
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
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const [removePopupPosition, setRemovePopupPosition] = useState<{ top: number; left: number } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deletePopupPosition, setDeletePopupPosition] = useState<{ top: number; left: number } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  const [pubkey, setPubkey] = useState<string>('')
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const textClass = useTextClass()

  const handleRemoveCancel = useCallback(() => {
    setConfirmRemove(null)
    setRemovePopupPosition(null)
  }, [])

  const handleDeleteCancel = useCallback(() => {
    setConfirmDelete(null)
    setDeletePopupPosition(null)
  }, [])

  // Close popup on scroll
  useEffect(() => {
    if (confirmRemove || confirmDelete) {
      const handleScroll = () => {
        handleRemoveCancel()
        handleDeleteCancel()
      }
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    }
  }, [confirmRemove, confirmDelete, handleRemoveCancel, handleDeleteCancel])

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

  const handleRemoveClick = (url: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setRemovePopupPosition({
      top: rect.top,
      left: rect.left + rect.width / 2,
    })
    setConfirmRemove(url)
  }

  const handleRemoveConfirm = async () => {
    if (!confirmRemove || !pubkey) return
    handleRemoveCancel()
    const success = await deleteUploadFromHistory(pubkey, confirmRemove)
    if (success) {
      setHistory(history.filter((item) => item.url !== confirmRemove))
    }
  }

  const handleDeleteClick = (url: string, e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setDeletePopupPosition({
      top: rect.top,
      left: rect.left + rect.width / 2,
    })
    setConfirmDelete(url)
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return
    handleDeleteCancel()
    await handleDeleteFromNostrBuild(confirmDelete)
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
              <CloseButton
                onClick={(e) => handleRemoveClick(item.url, e)}
                size={16}
                className="upload-history-remove-btn"
              />
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
                  <span className="upload-history-url-text">{item.url}</span>
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
                  onClick={(e) => handleDeleteClick(item.url, e)}
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

      {confirmRemove && removePopupPosition && (
        <>
          <div className="delete-confirm-overlay" onClick={handleRemoveCancel} />
          <div
            className="delete-confirm-popup"
            style={{ top: removePopupPosition.top, left: removePopupPosition.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="delete-confirm-header">
              <span className="delete-confirm-title">Remove?</span>
              <CloseButton onClick={handleRemoveCancel} size={16} />
            </div>
            <div className="delete-confirm-actions">
              <TextButton variant="warning" onClick={handleRemoveConfirm}>
                Yes
              </TextButton>
              <TextButton onClick={handleRemoveCancel}>No</TextButton>
            </div>
          </div>
        </>
      )}
      <LightBox />
      {confirmDelete && deletePopupPosition && (
        <DeleteConfirmDialog
          position={deletePopupPosition}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </div>
  )
}
