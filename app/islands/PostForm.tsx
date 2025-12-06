import { useState, useEffect } from 'hono/jsx'
import { createTextNote, createDeleteEvent, getLocalThemeColors, getThemeCardProps, type ThemeColors } from '../lib/nostr/events'
import { publishEvent } from '../lib/nostr/relay'
import { renderContent } from '../lib/content-parser'
import ProfileSetup, { hasLocalProfile } from './ProfileSetup'
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
}

export default function PostForm({ longMode, onLongModeChange, content, onContentChange, showPreview, onShowPreviewChange, editingEvent, onEditCancel, onEditComplete }: PostFormProps) {
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [hasProfile, setHasProfile] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null)

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
      // If editing, delete original first
      if (editingEvent) {
        const deleteEvent = await createDeleteEvent([editingEvent.id])
        await publishEvent(deleteEvent)
      }

      // Preserve reply tags when editing
      const preserveTags = editingEvent ? editingEvent.tags : undefined
      const event = await createTextNote(content.trim(), preserveTags)
      await publishEvent(event)
      onContentChange('')

      if (editingEvent && onEditComplete) {
        onEditComplete()
      }

      window.dispatchEvent(new CustomEvent('newpost'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  const handleCancel = () => {
    if (onEditCancel) {
      onEditCancel()
    }
  }

  const handleProfileSet = () => {
    setHasProfile(true)
    window.dispatchEvent(new CustomEvent('profileupdated'))
  }

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
    <form class={`post-form ${longMode ? 'long-mode' : ''} ${editingEvent ? 'editing' : ''}`} onSubmit={handleSubmit}>
      {editingEvent && (
        <div class="editing-label">Editing post...</div>
      )}
      <button
        type="button"
        class={`mode-toggle-corner ${longMode ? 'active' : ''}`}
        onClick={() => onLongModeChange(!longMode)}
      >
        {longMode ? 'Short mode' : 'Long mode'}
      </button>
      <textarea
        class="post-input"
        placeholder={longMode ? "マイペースに書こう\n\n長文モードでじっくり書けます" : "マイペースに書こう"}
        value={content}
        onInput={(e) => onContentChange((e.target as HTMLTextAreaElement).value)}
        rows={longMode ? 15 : 3}
        maxLength={4200}
      />
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
          {editingEvent && (
            <button type="button" class="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          )}
          <button type="submit" class="post-button" disabled={posting || !content.trim()}>
            {posting ? (editingEvent ? 'Saving...' : 'Posting...') : (editingEvent ? 'Save' : 'Post')}
          </button>
        </div>
      </div>
      {error && <p class="error">{error}</p>}
    </form>
  )
}
