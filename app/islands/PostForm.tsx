import { useState, useEffect, useRef } from 'hono/jsx'
import { createTextNote, createDeleteEvent, createReplyEvent, getLocalThemeColors, getThemeCardProps, type ThemeColors } from '../lib/nostr/events'
import { publishEvent } from '../lib/nostr/relay'
import { renderContent } from '../lib/content-parser'
import { uploadImage } from '../lib/upload'
import { getStoredVimMode, getStoredAppTheme } from './Settings'
import ProfileSetup, { hasLocalProfile } from './ProfileSetup'
import LongModeEditor from './LongModeEditor'
import type { Event } from 'nostr-tools'

interface PostFormProps {
  longMode: boolean
  onLongModeChange: (mode: boolean) => void
  content: string
  onContentChange: (content: string) => void
  showPreview: boolean
  onShowPreviewChange: (show: boolean) => void
  editingEvent?: Event | null
  onEditCancel?: () => void
  onEditComplete?: () => void
  replyingTo?: Event | null
  onReplyCancel?: () => void
  onReplyComplete?: () => void
}

export default function PostForm({ longMode, onLongModeChange, content, onContentChange, showPreview, onShowPreviewChange, editingEvent, onEditCancel, onEditComplete, replyingTo, onReplyCancel, onReplyComplete }: PostFormProps) {
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [hasProfile, setHasProfile] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [vimMode, setVimMode] = useState(false)
  const [darkTheme, setDarkTheme] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setHasProfile(hasLocalProfile())
    setCheckingProfile(false)
    setThemeColors(getLocalThemeColors())
    setVimMode(getStoredVimMode())
    setDarkTheme(getStoredAppTheme() === 'dark')

    const handleProfileUpdate = () => setHasProfile(hasLocalProfile())
    window.addEventListener('profileupdated', handleProfileUpdate)

    // Listen for settings changes to update vim mode and theme
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'mypace_vim_mode') {
        setVimMode(e.newValue === 'true')
      }
      if (e.key === 'mypace_app_theme') {
        setDarkTheme(e.newValue === 'dark')
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('profileupdated', handleProfileUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  const handleSubmit = async (e: globalThis.Event) => {
    e.preventDefault()
    if (!content.trim() || posting || !hasProfile) return

    setPosting(true)
    setError('')

    try {
      if (replyingTo) {
        // Create reply
        const event = await createReplyEvent(content.trim(), replyingTo)
        await publishEvent(event)
        onContentChange('')
        if (onReplyComplete) {
          onReplyComplete()
        }
      } else if (editingEvent) {
        // If editing, delete original first
        const deleteEvent = await createDeleteEvent([editingEvent.id])
        await publishEvent(deleteEvent)

        // Preserve reply tags when editing
        const preserveTags = editingEvent.tags
        const event = await createTextNote(content.trim(), preserveTags)
        await publishEvent(event)
        onContentChange('')

        if (onEditComplete) {
          onEditComplete()
        }
      } else {
        // Normal post
        const event = await createTextNote(content.trim())
        await publishEvent(event)
        onContentChange('')
      }

      window.dispatchEvent(new CustomEvent('newpost'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  const handleCancel = () => {
    if (replyingTo && onReplyCancel) {
      onReplyCancel()
    } else if (editingEvent && onEditCancel) {
      onEditCancel()
    }
  }

  const handleProfileSet = () => {
    setHasProfile(true)
    window.dispatchEvent(new CustomEvent('profileupdated'))
  }

  const handleUploadImage = async (file: File): Promise<string | null> => {
    setUploading(true)
    setError('')

    const result = await uploadImage(file)
    setUploading(false)

    if (result.success && result.url) {
      return result.url
    } else {
      setError(result.error || 'Failed to upload')
      return null
    }
  }

  const insertImageUrl = (url: string) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart || content.length
      const end = textarea.selectionEnd || content.length
      const before = content.slice(0, start)
      const after = content.slice(end)
      const newContent = before + (before && !before.endsWith('\n') ? '\n' : '') + url + (after && !after.startsWith('\n') ? '\n' : '') + after
      onContentChange(newContent)
    } else {
      onContentChange(content + (content ? '\n' : '') + url)
    }
  }

  const handleImageUpload = async (e: globalThis.Event) => {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    if (!file) return

    const url = await handleUploadImage(file)
    if (url) {
      insertImageUrl(url)
    }
    input.value = ''
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
  }

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
  }

  const handleDrop = async (e: DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)

    const files = e.dataTransfer?.files
    if (!files || files.length === 0) return

    const file = files[0]
    if (!file.type.startsWith('image/')) {
      setError('Please drop an image file')
      return
    }

    const url = await handleUploadImage(file)
    if (url) {
      insertImageUrl(url)
    }
  }

  const handleImageButtonClick = () => {
    fileInputRef.current?.click()
  }

  // Extract image URLs from content
  const getImageUrls = (): string[] => {
    const imageRegex = /https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<>"]*)?/gi
    const matches = content.match(imageRegex)
    return matches || []
  }

  const removeImageUrl = (urlToRemove: string) => {
    // Remove the URL and any surrounding newlines
    const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\n?${escapedUrl}\\n?`, 'g')
    const newContent = content.replace(regex, '\n').replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n')
    onContentChange(newContent)
  }

  const imageUrls = getImageUrls()

  if (checkingProfile) {
    return <div class="post-form loading">Loading...</div>
  }

  if (!hasProfile) {
    return (
      <div class="post-form">
        <ProfileSetup onProfileSet={handleProfileSet} />
      </div>
    )
  }

  const isSpecialMode = editingEvent || replyingTo

  return (
    <form
      class={`post-form ${longMode ? 'long-mode' : ''} ${editingEvent ? 'editing' : ''} ${replyingTo ? 'replying' : ''} ${content.trim() ? 'active' : ''}`}
      onSubmit={handleSubmit}
    >
      {editingEvent && (
        <div class="editing-label">Editing post...</div>
      )}
      {replyingTo && (
        <div class="replying-label">Replying to post...</div>
      )}
      <button
        type="button"
        class={`mode-toggle-corner ${longMode ? 'active' : ''}`}
        onClick={() => onLongModeChange(!longMode)}
      >
        {longMode ? 'Short mode' : 'Long mode'}
      </button>
      {longMode ? (
        <LongModeEditor
          value={content}
          onChange={onContentChange}
          placeholder="マイペースに書こう&#10;&#10;長文モードでじっくり書けます"
          vimMode={vimMode}
          darkTheme={darkTheme}
        />
      ) : (
        <textarea
          ref={textareaRef}
          class="post-input"
          placeholder="マイペースに書こう"
          value={content}
          onInput={(e) => onContentChange((e.target as HTMLTextAreaElement).value)}
          rows={3}
          maxLength={4200}
        />
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        style={{ display: 'none' }}
      />
      {imageUrls.length > 0 && (
        <div class="attached-images">
          {imageUrls.map((url) => (
            <div key={url} class="attached-image">
              <img src={url} alt="" />
              <button
                type="button"
                class="remove-image-button"
                onClick={() => removeImageUrl(url)}
                title="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {!longMode && showPreview && content.trim() && (() => {
        const themeProps = getThemeCardProps(themeColors)
        return (
          <div class={`post-preview ${themeProps.className}`} style={themeProps.style}>
            <div class="preview-label">Preview</div>
            <div class="preview-content">
              {renderContent(content)}
            </div>
          </div>
        )
      })()}
      <div class="post-actions">
        <div class="post-actions-left">
          <div
            class={`image-drop-area ${dragging ? 'dragging' : ''}`}
            onClick={handleImageButtonClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {uploading ? '...' : dragging ? 'Drop' : '📷'}
          </div>
          <button
            type="button"
            class={`preview-toggle ${showPreview ? 'active' : ''}`}
            onClick={() => onShowPreviewChange(!showPreview)}
          >
            {showPreview ? 'Hide' : 'Preview'}
          </button>
          <span class="char-count">{content.length}/4200</span>
        </div>
        <div class="post-actions-right">
          {isSpecialMode && (
            <button type="button" class="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          )}
          <button type="submit" class="post-button" disabled={posting || !content.trim()}>
            {posting
              ? (editingEvent ? 'Saving...' : replyingTo ? 'Replying...' : 'Posting...')
              : (editingEvent ? 'Save' : replyingTo ? 'Reply' : 'Post')}
          </button>
        </div>
      </div>
      {error && <p class="error">{error}</p>}
    </form>
  )
}
