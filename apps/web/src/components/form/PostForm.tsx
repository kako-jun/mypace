import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createTextNote,
  createDeleteEvent,
  createReplyEvent,
  getStoredThemeColors,
  getCurrentPubkey,
} from '../../lib/nostr/events'
import { navigateToUser } from '../../lib/utils'
import type { ThemeColors, EmojiTag, Sticker, Event, StickerQuadrant, StickerLayer } from '../../types'
import { publishEvent } from '../../lib/nostr/relay'
import { ProfileSetup } from '../user'
import {
  hasLocalProfile,
  getLocalProfile,
  getImageUrls,
  removeImageUrl,
  getStoredVimMode,
  getStoredAppTheme,
} from '../../lib/utils'
import { CUSTOM_EVENTS, LIMITS, STORAGE_KEYS } from '../../lib/constants'
import { ImageDropZone, AttachedImages, PostPreview } from '../post'
import { Avatar, Icon, TextButton, ErrorMessage } from '../ui'
import { setBoolean } from '../../lib/utils/storage'
import { StickerPicker } from '../sticker'
import { SuperMentionPopup } from '../superMention'
import { LocationPicker } from '../location'
import { FormActions, ShortTextEditor, PostFormLongMode } from './index'
import type { ShortTextEditorRef } from './ShortTextEditor'

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
  const [stickers, setStickers] = useState<Sticker[]>([])
  const [showSuperMentionPopup, setShowSuperMentionPopup] = useState(false)
  const [showLocationPicker, setShowLocationPicker] = useState(false)
  const [location, setLocation] = useState<{ geohash: string; name?: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shortTextEditorRef = useRef<ShortTextEditorRef>(null)
  const fileImportRef = useRef<HTMLInputElement>(null)

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

  // 編集モード時にシールと座標を復元
  useEffect(() => {
    if (editingEvent && editingEvent.tags) {
      // Restore stickers
      const stickerTags = editingEvent.tags.filter((tag) => tag[0] === 'sticker')
      const validQuadrants: StickerQuadrant[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      const validLayers: StickerLayer[] = ['front', 'back']
      const restoredStickers: Sticker[] = stickerTags
        .map((tag): Sticker | null => {
          const [, url, x, y, size, rotation, quadrant, layer] = tag
          if (!url) return null
          return {
            url,
            x: parseFloat(x) || 50,
            y: parseFloat(y) || 50,
            size: parseFloat(size) || 15,
            rotation: parseFloat(rotation) || 0,
            quadrant: (quadrant && validQuadrants.includes(quadrant as StickerQuadrant)
              ? quadrant
              : 'top-left') as StickerQuadrant,
            layer: layer && validLayers.includes(layer as StickerLayer) ? (layer as StickerLayer) : undefined,
          }
        })
        .filter((s): s is Sticker => s !== null)
      setStickers(restoredStickers)

      // Restore location
      const gTag = editingEvent.tags.find((tag) => tag[0] === 'g')
      const locationTag = editingEvent.tags.find((tag) => tag[0] === 'location')
      if (gTag && gTag[1]) {
        setLocation({ geohash: gTag[1], name: locationTag?.[1] })
      } else {
        setLocation(null)
      }
    } else {
      setStickers([])
      setLocation(null)
    }
  }, [editingEvent])

  const handleVimModeChange = (enabled: boolean) => {
    setVimMode(enabled)
    setBoolean(STORAGE_KEYS.VIM_MODE, enabled)
  }

  const handleLongModeToggle = () => {
    if (!longMode) {
      onShowPreviewChange(true)
      onLongModeChange(true)
    } else {
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
      const stickerTags = stickers.map((s) => {
        const tag = [
          'sticker',
          s.url,
          `${Math.round(s.x)}`,
          `${Math.round(s.y)}`,
          `${Math.round(s.size)}`,
          `${Math.round(s.rotation)}`,
          s.quadrant,
        ]
        // Only add layer if it's 'back' (front is default)
        if (s.layer === 'back') {
          tag.push(s.layer)
        }
        return tag
      })

      // Location tags (NIP-52 compliant)
      const locationTags: string[][] = []
      if (location) {
        locationTags.push(['g', location.geohash])
        if (location.name) {
          locationTags.push(['location', location.name])
        }
      }

      const extraTags = [...stickerTags, ...locationTags]

      if (replyingTo) {
        const event = await createReplyEvent(content.trim(), replyingTo, undefined, extraTags)
        await publishEvent(event)
        onContentChange('')
        setStickers([])
        setLocation(null)
        onReplyComplete?.()
      } else if (editingEvent) {
        const deleteEvent = await createDeleteEvent([editingEvent.id])
        await publishEvent(deleteEvent)
        const preserveTags = editingEvent.tags.filter((tag) => !['sticker', 'g', 'location'].includes(tag[0]))
        const event = await createTextNote(content.trim(), preserveTags, extraTags)
        await publishEvent(event)
        onContentChange('')
        setStickers([])
        setLocation(null)
        onEditComplete?.()
      } else {
        const event = await createTextNote(content.trim(), undefined, extraTags)
        await publishEvent(event)
        onContentChange('')
        setStickers([])
        setLocation(null)
      }

      window.dispatchEvent(new CustomEvent(CUSTOM_EVENTS.NEW_POST))

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

  const handleAddSticker = (sticker: Omit<Sticker, 'x' | 'y' | 'size' | 'rotation' | 'quadrant'>) => {
    if (stickers.length >= LIMITS.MAX_STICKERS) return
    const newSticker: Sticker = { ...sticker, x: 50, y: 50, size: 15, rotation: 0, quadrant: 'top-left' }
    setStickers([...stickers, newSticker])
    if (!showPreview) {
      onShowPreviewChange(true)
    }
  }

  const handleRemoveSticker = (index: number) => {
    setStickers(stickers.filter((_, i) => i !== index))
  }

  const handleStickerMove = (index: number, x: number, y: number, quadrant: StickerQuadrant) => {
    const updatedStickers = [...stickers]
    updatedStickers[index] = { ...updatedStickers[index], x: Math.round(x), y: Math.round(y), quadrant }
    setStickers(updatedStickers)
  }

  const handleStickerResize = (index: number, size: number) => {
    const updatedStickers = [...stickers]
    updatedStickers[index] = { ...updatedStickers[index], size: Math.round(size) }
    setStickers(updatedStickers)
  }

  const handleStickerRotate = (index: number, rotation: number) => {
    const updatedStickers = [...stickers]
    updatedStickers[index] = { ...updatedStickers[index], rotation }
    setStickers(updatedStickers)
  }

  const handleStickerLayerChange = (index: number, layer: StickerLayer) => {
    const updatedStickers = [...stickers]
    updatedStickers[index] = { ...updatedStickers[index], layer }
    setStickers(updatedStickers)
  }

  const handleFileImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        onContentChange(text)
      } catch {
        setError('Failed to read file')
      }

      // Reset input
      e.target.value = ''
    },
    [onContentChange]
  )

  const imageUrls = getImageUrls(content)

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

  // Long mode
  if (longMode) {
    return (
      <PostFormLongMode
        content={content}
        onContentChange={onContentChange}
        showPreview={showPreview}
        onShowPreviewChange={onShowPreviewChange}
        editingEvent={editingEvent}
        replyingTo={replyingTo}
        posting={posting}
        error={error}
        vimMode={vimMode}
        onVimModeChange={handleVimModeChange}
        darkTheme={darkTheme}
        themeColors={themeColors}
        myAvatarUrl={myAvatarUrl}
        myEmojis={myEmojis}
        imageUrls={imageUrls}
        stickers={stickers}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
        onLongModeToggle={handleLongModeToggle}
        onAvatarClick={handleAvatarClick}
        onRemoveImage={handleRemoveImage}
        onError={setError}
        onAddSticker={handleAddSticker}
        onRemoveSticker={handleRemoveSticker}
        onStickerMove={handleStickerMove}
        onStickerResize={handleStickerResize}
        onStickerRotate={handleStickerRotate}
        onStickerLayerChange={handleStickerLayerChange}
        location={location}
        onLocationChange={setLocation}
      />
    )
  }

  // Short mode: minimized
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

  // Short mode: full
  return (
    <form
      className={`post-form ${editingEvent ? 'editing' : ''} ${replyingTo ? 'replying' : ''} ${content.trim() ? 'active' : ''}`}
      onSubmit={handleSubmit}
    >
      {editingEvent && <div className="editing-label">Editing post...</div>}
      {replyingTo && <div className="replying-label">Replying to post...</div>}

      <div className="post-form-row-1">
        <button type="button" className="post-form-avatar-button" onClick={handleAvatarClick}>
          <Avatar src={myAvatarUrl} size="small" className="post-form-avatar" />
        </button>
        <div className="post-form-spacer" />
        <TextButton variant="primary" className="mode-toggle-corner" onClick={handleLongModeToggle}>
          LONG ↗
        </TextButton>
        <button
          type="button"
          className="minimize-button"
          onClick={() => setMinimized(true)}
          aria-label="Minimize editor"
        >
          <Icon name="Minus" size={20} strokeWidth={3} />
        </button>
      </div>

      <div className="post-form-row-2">
        {!content && (
          <>
            <button
              type="button"
              className="file-import-button"
              onClick={() => fileImportRef.current?.click()}
              title="Import text file"
            >
              <Icon name="FileUp" size={16} />
            </button>
            <input
              ref={fileImportRef}
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
          </>
        )}
        <button
          type="button"
          className="super-mention-button"
          onClick={() => setShowSuperMentionPopup(true)}
          title="Super Mention (@@)"
        >
          @@
        </button>
        <ImageDropZone onImageUploaded={insertImageUrl} onError={setError} />
        <StickerPicker onAddSticker={handleAddSticker} />
        <button
          type="button"
          className="location-button"
          onClick={() => setShowLocationPicker(true)}
          title="Add location"
        >
          <Icon name="MapPin" size={16} />
        </button>
        {location && (
          <div className="location-indicator">
            <Icon name="MapPin" size={14} />
            <span>{location.name || location.geohash}</span>
            <button type="button" className="location-remove" onClick={() => setLocation(null)} title="Remove location">
              <Icon name="X" size={12} />
            </button>
          </div>
        )}
      </div>

      <ShortTextEditor
        ref={shortTextEditorRef}
        content={content}
        onContentChange={onContentChange}
        onSuperMentionTrigger={() => setShowSuperMentionPopup(true)}
      />

      <AttachedImages imageUrls={imageUrls} onRemove={handleRemoveImage} />

      {showPreview && (
        <PostPreview
          content={content}
          themeColors={themeColors}
          emojis={myEmojis}
          stickers={stickers}
          editableStickers
          onStickerMove={handleStickerMove}
          onStickerResize={handleStickerResize}
          onStickerRotate={handleStickerRotate}
          onStickerLayerChange={handleStickerLayerChange}
          onStickerRemove={handleRemoveSticker}
        />
      )}

      <FormActions
        content={content}
        posting={posting}
        showPreview={showPreview}
        onShowPreviewChange={onShowPreviewChange}
        editingEvent={editingEvent}
        replyingTo={replyingTo}
        onCancel={handleCancel}
      />

      <ErrorMessage>{error}</ErrorMessage>

      {showSuperMentionPopup && (
        <SuperMentionPopup
          onSelect={(text) => shortTextEditorRef.current?.insertText(text)}
          onClose={() => setShowSuperMentionPopup(false)}
        />
      )}

      {showLocationPicker && (
        <LocationPicker
          onSelect={(geohash, name) => {
            setLocation({ geohash, name })
            setShowLocationPicker(false)
          }}
          onClose={() => setShowLocationPicker(false)}
        />
      )}
    </form>
  )
}
