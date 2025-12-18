import { useState, useEffect, useRef } from 'react'
import {
  createTextNote,
  createDeleteEvent,
  createReplyEvent,
  getStoredThemeColors,
  getCurrentPubkey,
} from '../lib/nostr/events'
import { navigateToUser } from '../lib/utils'
import type { ThemeColors, EmojiTag } from '../types'
import { publishEvent } from '../lib/nostr/relay'
import { ProfileSetup } from './ProfileSetup'
import {
  hasLocalProfile,
  getLocalProfile,
  getImageUrls,
  removeImageUrl,
  getStoredVimMode,
  getStoredAppTheme,
} from '../lib/utils'
import { CUSTOM_EVENTS, LIMITS, STORAGE_KEYS } from '../lib/constants'
import { ImageDropZone, AttachedImages, PostPreview } from '../components/post'
import { LongModeEditor } from './LongModeEditor'
import { Toggle, Avatar, Icon } from './ui'
import { setBoolean } from '../lib/utils/storage'
import type { Event } from '../types'

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

export function PostForm({
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
  onReplyComplete,
}: PostFormProps) {
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [hasProfile, setHasProfile] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null)
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | undefined>(undefined)
  const [myEmojis, setMyEmojis] = useState<EmojiTag[]>([])
  const [vimMode, setVimMode] = useState(() => getStoredVimMode())
  const [darkTheme, setDarkTheme] = useState(() => getStoredAppTheme() === 'dark')
  const [minimized, setMinimized] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const longModeFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const profile = getLocalProfile()
    setHasProfile(hasLocalProfile())
    setCheckingProfile(false)
    setThemeColors(getStoredThemeColors())
    setMyAvatarUrl(profile?.picture)
    setMyEmojis(profile?.emojis || [])

    const handleProfileUpdate = () => {
      const updatedProfile = getLocalProfile()
      setHasProfile(hasLocalProfile())
      setMyAvatarUrl(updatedProfile?.picture)
      setMyEmojis(updatedProfile?.emojis || [])
    }
    const handleThemeColorsChange = () => setThemeColors(getStoredThemeColors())
    const handleAppThemeChange = () => setDarkTheme(getStoredAppTheme() === 'dark')

    window.addEventListener(CUSTOM_EVENTS.PROFILE_UPDATED, handleProfileUpdate)
    window.addEventListener(CUSTOM_EVENTS.THEME_COLORS_CHANGED, handleThemeColorsChange)
    window.addEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    return () => {
      window.removeEventListener(CUSTOM_EVENTS.PROFILE_UPDATED, handleProfileUpdate)
      window.removeEventListener(CUSTOM_EVENTS.THEME_COLORS_CHANGED, handleThemeColorsChange)
      window.removeEventListener(CUSTOM_EVENTS.APP_THEME_CHANGED, handleAppThemeChange)
    }
  }, [])

  const handleVimModeChange = (enabled: boolean) => {
    setVimMode(enabled)
    setBoolean(STORAGE_KEYS.VIM_MODE, enabled)
  }

  // Handle long mode toggle: auto-enable preview when entering, disable when leaving
  const handleLongModeToggle = () => {
    if (!longMode) {
      // Entering long mode: turn preview on
      onShowPreviewChange(true)
      onLongModeChange(true)
    } else {
      // Leaving long mode: turn preview off
      onShowPreviewChange(false)
      onLongModeChange(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!content.trim() || posting || !hasProfile) return
    if (content.length > LIMITS.MAX_POST_LENGTH) {
      setError(`Content exceeds ${LIMITS.MAX_POST_LENGTH} characters`)
      return
    }

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

      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.NEW_POST))

      // Exit long mode after successful post
      if (longMode) {
        onLongModeChange(false)
      }
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
    window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.PROFILE_UPDATED))
  }

  const handleAvatarClick = async () => {
    const pubkey = await getCurrentPubkey()
    navigateToUser(pubkey)
  }

  const insertImageUrl = (url: string) => {
    const textarea = textareaRef.current
    if (textarea) {
      const start = textarea.selectionStart || content.length
      const end = textarea.selectionEnd || content.length
      const before = content.slice(0, start)
      const after = content.slice(end)
      const newContent =
        before +
        (before && !before.endsWith('\n') ? '\n' : '') +
        url +
        (after && !after.startsWith('\n') ? '\n' : '') +
        after
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
    return <div className="post-form loading">Loading...</div>
  }

  if (!hasProfile) {
    return (
      <div className="post-form">
        <ProfileSetup onProfileSet={handleProfileSet} />
      </div>
    )
  }

  // Long mode: full-screen layout with preview
  if (longMode) {
    return (
      <div className={`long-mode-container ${showPreview ? 'with-preview' : 'no-preview'}`}>
        <button
          type="button"
          className="long-mode-exit-button text-outlined text-outlined-button text-outlined-primary"
          onClick={handleLongModeToggle}
        >
          ↙ SHORT
        </button>

        <div className="long-mode-editor-pane">
          <form
            ref={longModeFormRef}
            className={`post-form long-mode ${editingEvent ? 'editing' : ''} ${replyingTo ? 'replying' : ''} ${content.trim() ? 'active' : ''}`}
            onSubmit={handleSubmit}
          >
            {editingEvent && <div className="editing-label">Editing post...</div>}
            {replyingTo && <div className="replying-label">Replying to post...</div>}

            <div className="post-form-top-actions">
              <button type="button" className="post-form-avatar-button" onClick={handleAvatarClick}>
                <Avatar src={myAvatarUrl} size="small" className="post-form-avatar" />
              </button>
              <ImageDropZone onImageUploaded={insertImageUrl} onError={setError} />
              <div className="vim-toggle">
                <Toggle checked={vimMode} onChange={handleVimModeChange} label="Vim" />
              </div>
            </div>

            <LongModeEditor
              value={content}
              onChange={onContentChange}
              placeholder="マイペースで書こう"
              vimMode={vimMode}
              darkTheme={darkTheme}
              onWrite={() => longModeFormRef.current?.requestSubmit()}
              onQuit={handleLongModeToggle}
            />

            <AttachedImages imageUrls={imageUrls} onRemove={handleRemoveImage} />

            <div className="post-actions">
              <div className="post-actions-left">
                <button
                  type="button"
                  className={`preview-toggle text-outlined text-outlined-button text-outlined-primary ${showPreview ? 'active' : ''}`}
                  onClick={() => onShowPreviewChange(!showPreview)}
                >
                  {showPreview ? 'HIDE' : 'PREVIEW'}
                </button>
                <span className={`char-count ${content.length > LIMITS.FOLD_THRESHOLD ? 'char-count-fold' : ''}`}>
                  {content.length}/{LIMITS.MAX_POST_LENGTH}
                  {content.length > LIMITS.FOLD_THRESHOLD && ' (folded)'}
                </span>
              </div>
              <div className="post-actions-right">
                {isSpecialMode && (
                  <button type="button" className="cancel-button" onClick={handleCancel}>
                    Cancel
                  </button>
                )}
                <button type="submit" className="post-button" disabled={posting || !content.trim()}>
                  {posting
                    ? editingEvent
                      ? 'Saving...'
                      : replyingTo
                        ? 'Replying...'
                        : 'Posting...'
                    : editingEvent
                      ? 'Save'
                      : replyingTo
                        ? 'Reply'
                        : 'Post'}
                </button>
              </div>
            </div>

            {error && <p className="error">{error}</p>}
          </form>
        </div>

        {showPreview && (
          <div className="long-mode-preview-pane">
            <PostPreview content={content} themeColors={themeColors} transparentBackground emojis={myEmojis} />
          </div>
        )}
      </div>
    )
  }

  // Short mode: compact form at bottom-left
  // Minimized view: just avatar in a small square
  if (minimized) {
    return (
      <button
        type="button"
        className="post-form-minimized"
        onClick={() => setMinimized(false)}
        aria-label="Expand editor"
      >
        <Avatar src={myAvatarUrl} size="small" />
      </button>
    )
  }

  return (
    <form
      className={`post-form ${editingEvent ? 'editing' : ''} ${replyingTo ? 'replying' : ''} ${content.trim() ? 'active' : ''}`}
      onSubmit={handleSubmit}
    >
      {editingEvent && <div className="editing-label">Editing post...</div>}
      {replyingTo && <div className="replying-label">Replying to post...</div>}

      <div className="post-form-top-actions">
        <button type="button" className="post-form-avatar-button" onClick={handleAvatarClick}>
          <Avatar src={myAvatarUrl} size="small" className="post-form-avatar" />
        </button>
        <ImageDropZone onImageUploaded={insertImageUrl} onError={setError} />
        <button
          type="button"
          className="mode-toggle-corner text-outlined text-outlined-button text-outlined-primary"
          onClick={handleLongModeToggle}
        >
          LONG ↗
        </button>
        <button
          type="button"
          className="minimize-button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize editor"
        >
          <Icon name="Minus" size={20} strokeWidth={3} />
        </button>
      </div>

      <div className="post-input-wrapper">
        <textarea
          ref={textareaRef}
          className="post-input"
          placeholder="マイペースで書こう"
          value={content}
          onInput={(e) => onContentChange((e.target as HTMLTextAreaElement).value)}
          rows={3}
          maxLength={LIMITS.MAX_POST_LENGTH}
        />
        {content && (
          <button
            type="button"
            className="clear-content-button"
            onClick={() => onContentChange('')}
            aria-label="Clear content"
          >
            ×
          </button>
        )}
      </div>

      <AttachedImages imageUrls={imageUrls} onRemove={handleRemoveImage} />

      {showPreview && <PostPreview content={content} themeColors={themeColors} emojis={myEmojis} />}

      <div className="post-actions">
        <div className="post-actions-left">
          <button
            type="button"
            className={`preview-toggle text-outlined text-outlined-button text-outlined-primary ${showPreview ? 'active' : ''}`}
            onClick={() => onShowPreviewChange(!showPreview)}
          >
            {showPreview ? 'HIDE' : 'PREVIEW'}
          </button>
          <span className={`char-count ${content.length > LIMITS.FOLD_THRESHOLD ? 'char-count-fold' : ''}`}>
            {content.length}/{LIMITS.MAX_POST_LENGTH}
            {content.length > LIMITS.FOLD_THRESHOLD && ' (folded)'}
          </span>
        </div>
        <div className="post-actions-right">
          {isSpecialMode && (
            <button type="button" className="cancel-button" onClick={handleCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="post-button" disabled={posting || !content.trim()}>
            {posting
              ? editingEvent
                ? 'Saving...'
                : replyingTo
                  ? 'Replying...'
                  : 'Posting...'
              : editingEvent
                ? 'Save'
                : replyingTo
                  ? 'Reply'
                  : 'Post'}
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
    </form>
  )
}
