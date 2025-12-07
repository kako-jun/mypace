import { useState, useEffect, useRef } from 'hono/jsx'
import { createTextNote, createDeleteEvent, createReplyEvent, getLocalThemeColors, type ThemeColors } from '../lib/nostr/events'
import { publishEvent } from '../lib/nostr/relay'
import ProfileSetup, { hasLocalProfile } from './ProfileSetup'
import { ImageDropZone, AttachedImages, PostPreview } from '../components/post'
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

// Extract image URLs from content
function getImageUrls(content: string): string[] {
  const imageRegex = /https?:\/\/[^\s<>"]+\.(jpg|jpeg|png|gif|webp|svg)(\?[^\s<>"]*)?/gi
  return content.match(imageRegex) || []
}

// Remove image URL from content
function removeImageUrl(content: string, urlToRemove: string): string {
  const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`\\n?${escapedUrl}\\n?`, 'g')
  return content.replace(regex, '\n').replace(/^\n+|\n+$/g, '').replace(/\n{3,}/g, '\n\n')
}

export default function PostForm({
  longMode,
  onLongModeChange,
  content,
  onContentChange,
  showPreview,
  onShowPreviewChange,
  editingEvent,
  onEditCancel,
  onEditComplete,
  replyingTo,
  onReplyCancel,
  onReplyComplete
}: PostFormProps) {
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [hasProfile, setHasProfile] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setHasProfile(hasLocalProfile())
    setCheckingProfile(false)
    setThemeColors(getLocalThemeColors())

    const handleProfileUpdate = () => setHasProfile(hasLocalProfile())
    window.addEventListener('profileupdated', handleProfileUpdate)
    return () => window.removeEventListener('profileupdated', handleProfileUpdate)
  }, [])

  const handleSubmit = async (e: globalThis.Event) => {
    e.preventDefault()
    if (!content.trim() || posting || !hasProfile) return

    setPosting(true)
    setError('')

    try {
      if (replyingTo) {
        const event = await createReplyEvent(content.trim(), replyingTo)
        await publishEvent(event)
        onContentChange('')
        onReplyComplete?.()
      } else if (editingEvent) {
        const deleteEvent = await createDeleteEvent([editingEvent.id])
        await publishEvent(deleteEvent)
        const preserveTags = editingEvent.tags
        const event = await createTextNote(content.trim(), preserveTags)
        await publishEvent(event)
        onContentChange('')
        onEditComplete?.()
      } else {
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
    if (replyingTo) {
      onReplyCancel?.()
    } else if (editingEvent) {
      onEditCancel?.()
    }
  }

  const handleProfileSet = () => {
    setHasProfile(true)
    window.dispatchEvent(new CustomEvent('profileupdated'))
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

  const handleRemoveImage = (url: string) => {
    onContentChange(removeImageUrl(content, url))
  }

  const imageUrls = getImageUrls(content)
  const isSpecialMode = editingEvent || replyingTo

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

  return (
    <form
      class={`post-form ${longMode ? 'long-mode' : ''} ${editingEvent ? 'editing' : ''} ${replyingTo ? 'replying' : ''} ${content.trim() ? 'active' : ''}`}
      onSubmit={handleSubmit}
    >
      {editingEvent && <div class="editing-label">Editing post...</div>}
      {replyingTo && <div class="replying-label">Replying to post...</div>}

      <button
        type="button"
        class={`mode-toggle-corner ${longMode ? 'active' : ''}`}
        onClick={() => onLongModeChange(!longMode)}
      >
        {longMode ? 'Short mode' : 'Long mode'}
      </button>

      <textarea
        ref={textareaRef}
        class="post-input"
        placeholder={longMode ? "マイペースに書こう\n\n長文モードでじっくり書けます" : "マイペースに書こう"}
        value={content}
        onInput={(e) => onContentChange((e.target as HTMLTextAreaElement).value)}
        rows={longMode ? 15 : 3}
        maxLength={4200}
      />

      <AttachedImages imageUrls={imageUrls} onRemove={handleRemoveImage} />

      {!longMode && showPreview && (
        <PostPreview content={content} themeColors={themeColors} />
      )}

      <div class="post-actions">
        <div class="post-actions-left">
          <ImageDropZone
            onImageUploaded={insertImageUrl}
            onError={setError}
          />
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
