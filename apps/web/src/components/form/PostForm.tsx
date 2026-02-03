import { useState, useEffect, useRef, useCallback } from 'react'
import {
  createTextNote,
  createDeleteEvent,
  createReplyEvent,
  getStoredThemeColors,
  getCurrentPubkey,
  STELLA_COLORS,
  type StellaColor,
} from '../../lib/nostr/events'
import { exportNpub } from '../../lib/nostr/keys'
import '../../styles/components/post-form.css'
import { navigateToUser } from '../../lib/utils'
import type { ThemeColors, EmojiTag, Sticker, Event, StickerQuadrant, StickerLayer, Profile } from '../../types'
import { publishEvent, fetchUserProfile } from '../../lib/nostr/relay'
import { ProfileSetup } from '../user'
import {
  hasLocalProfile,
  getLocalProfile,
  getImageUrls,
  removeImageUrl,
  getStoredVimMode,
  getStoredAppTheme,
  normalizeContent,
  getDisplayName,
} from '../../lib/utils'
import { CUSTOM_EVENTS, LIMITS } from '../../lib/constants'
import { AttachedImages, AttachedLocations, PostPreview } from '../post'
import { Avatar, Icon, TextButton, ErrorMessage } from '../ui'
import { setVimMode as saveVimMode } from '../../lib/storage'
import { ImagePicker } from '../sticker'
import { useDragDrop } from '../../hooks'
import { SuperMentionPopup } from '../superMention'
import { LocationPicker } from '../location'
import { DrawingPicker } from '../drawing'
import { VoicePicker } from '../voice'
import { FormActions, ShortTextEditor, PostFormLongMode, TeaserPicker } from './index'
import type { ShortTextEditorRef } from './ShortTextEditor'
import { getTeaserColor } from '../../lib/nostr/tags'

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
  sharedImageFile?: File | null
  onSharedImageProcessed?: () => void
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
  sharedImageFile,
  onSharedImageProcessed,
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
  const [locations, setLocations] = useState<{ geohash: string; name?: string }[]>([])
  const [replyToProfile, setReplyToProfile] = useState<Profile | null | undefined>(undefined)
  const [teaserColor, setTeaserColor] = useState<StellaColor | null>(null)
  const [showTeaserPicker, setShowTeaserPicker] = useState(false)
  const teaserButtonRef = useRef<HTMLButtonElement>(null)
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

      // Restore locations
      const gTags = editingEvent.tags.filter((tag) => tag[0] === 'g')
      const locationTags = editingEvent.tags.filter((tag) => tag[0] === 'location')
      const restoredLocations = gTags.map((gTag, i) => ({
        geohash: gTag[1],
        name: locationTags[i]?.[1],
      }))
      setLocations(restoredLocations)

      // Restore teaser color
      const restoredTeaserColor = getTeaserColor(editingEvent.tags) as StellaColor | undefined
      setTeaserColor(restoredTeaserColor ?? null)
    } else {
      setStickers([])
      setLocations([])
      setTeaserColor(null)
    }
  }, [editingEvent])

  // Expand minimized editor when replying or editing
  useEffect(() => {
    if (replyingTo || editingEvent) {
      setMinimized(false)
    }
  }, [replyingTo, editingEvent])

  // Fetch reply target's profile
  useEffect(() => {
    let pubkey: string | undefined
    if (replyingTo) {
      pubkey = replyingTo.pubkey
    } else if (editingEvent) {
      // Only get pubkey if editing event is a reply
      const replyTag = editingEvent.tags?.find((t) => t[0] === 'e' && (t[3] === 'reply' || t[3] === 'root'))
      if (replyTag) {
        pubkey = editingEvent.tags?.find((t) => t[0] === 'p')?.[1]
      }
    }
    if (!pubkey) {
      setReplyToProfile(undefined)
      return
    }
    setReplyToProfile(undefined) // Reset to loading state
    fetchUserProfile(pubkey).then((profile) => {
      setReplyToProfile(profile)
    })
  }, [replyingTo, editingEvent])

  const handleVimModeChange = (enabled: boolean) => {
    setVimMode(enabled)
    saveVimMode(enabled)
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
    const normalizedContent = normalizeContent(content)
    if (!normalizedContent || posting || !hasProfile) return
    if (normalizedContent.length > LIMITS.MAX_POST_LENGTH) {
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
      for (const loc of locations) {
        locationTags.push(['g', loc.geohash])
        if (loc.name) {
          locationTags.push(['location', loc.name])
        }
      }

      const extraTags = [...stickerTags, ...locationTags]

      // Teaser processing: split content if > 280 chars and teaserColor is set
      let finalContent = normalizedContent
      if (teaserColor && normalizedContent.length > LIMITS.FOLD_THRESHOLD) {
        const pubkey = await getCurrentPubkey()
        const npub = exportNpub(pubkey)
        const baseContent = normalizedContent.slice(0, LIMITS.FOLD_THRESHOLD)
        const teaserContent = normalizedContent.slice(LIMITS.FOLD_THRESHOLD)
        const readMoreLink = `\n\n...READ MORE → https://mypace.llll-ll.com/user/${npub}`
        finalContent = baseContent + readMoreLink
        extraTags.push(['teaser', teaserContent, teaserColor])
      }

      if (replyingTo) {
        const event = await createReplyEvent(finalContent, replyingTo, undefined, extraTags)
        await publishEvent(event)
        onContentChange('')
        setStickers([])
        setLocations([])
        setTeaserColor(null)
        onReplyComplete?.()
      } else if (editingEvent) {
        const deleteEvent = await createDeleteEvent([editingEvent.id])
        await publishEvent(deleteEvent)
        const preserveTags = editingEvent.tags.filter((tag) => !['sticker', 'g', 'location', 'teaser'].includes(tag[0]))
        const event = await createTextNote(finalContent, preserveTags, extraTags)
        await publishEvent(event)
        onContentChange('')
        setStickers([])
        setLocations([])
        setTeaserColor(null)
        onEditComplete?.()
      } else {
        const event = await createTextNote(finalContent, undefined, extraTags)
        await publishEvent(event)
        onContentChange('')
        setStickers([])
        setLocations([])
        setTeaserColor(null)
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
    shortTextEditorRef.current?.insertText(url + '\n')
  }

  const handleRemoveImage = (url: string) => {
    onContentChange(removeImageUrl(content, url))
  }

  const handleAddSticker = (sticker: Omit<Sticker, 'x' | 'y' | 'size' | 'rotation' | 'quadrant'>) => {
    if (stickers.length >= LIMITS.MAX_STICKERS) return
    const newSticker: Sticker = { ...sticker, x: 50, y: 50, size: 15, rotation: 0, quadrant: 'top-left', layer: 'back' }
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

  const processFileImport = useCallback(
    async (file: File) => {
      const validTypes = ['text/plain', 'text/markdown', '']
      const validExtensions = ['.txt', '.md', '.markdown']
      const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
      if (!validTypes.includes(file.type) && !hasValidExt) {
        setError('Please drop a .txt or .md file')
        return
      }
      try {
        const text = await file.text()
        onContentChange(text)
      } catch {
        setError('Failed to read file')
      }
    },
    [onContentChange]
  )

  const { dragging: fileImportDragging, handlers: fileImportHandlers } = useDragDrop(processFileImport)

  const handleFileImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      await processFileImport(file)
      e.target.value = ''
    },
    [processFileImport]
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
        replyToProfile={replyToProfile}
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
        locations={locations}
        onLocationsChange={setLocations}
        teaserColor={teaserColor}
        onTeaserColorChange={setTeaserColor}
        sharedImageFile={sharedImageFile}
        onSharedImageProcessed={onSharedImageProcessed}
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
      {editingEvent &&
        (() => {
          // Check if the event being edited is a reply (has e tag with root/reply marker)
          const replyTag = editingEvent.tags?.find((t) => t[0] === 'e' && (t[3] === 'reply' || t[3] === 'root'))
          const replyPubkey = editingEvent.tags?.find((t) => t[0] === 'p')?.[1]
          if (replyTag && replyPubkey) {
            return (
              <>
                <div className="replying-label">
                  <span>Reply</span>
                  <span className="reply-to-name">→ @{getDisplayName(replyToProfile, replyPubkey)}</span>
                </div>
                <div className="editing-label">Editing</div>
              </>
            )
          }
          return <div className="editing-label">Editing</div>
        })()}
      {replyingTo && (
        <div className="replying-label">
          <span>Reply</span>
          <span className="reply-to-name">→ @{getDisplayName(replyToProfile, replyingTo.pubkey)}</span>
        </div>
      )}

      <div className="post-form-row-1">
        <button type="button" className="post-form-avatar-button" onClick={handleAvatarClick}>
          <Avatar src={myAvatarUrl} size="small" className="post-form-avatar" />
        </button>
        {!content && (
          <label
            className={`file-import-area ${fileImportDragging ? 'dragging' : ''}`}
            title="Import text file"
            onDragOver={fileImportHandlers.onDragOver}
            onDragLeave={fileImportHandlers.onDragLeave}
            onDrop={fileImportHandlers.onDrop}
          >
            <Icon name="FileUp" size={16} />
            <input
              ref={fileImportRef}
              type="file"
              accept=".md,.txt,text/markdown,text/plain"
              onChange={handleFileImport}
              style={{ display: 'none' }}
            />
          </label>
        )}
        <button
          type="button"
          className="super-mention-button"
          onClick={() => setShowSuperMentionPopup(true)}
          title="Super Mention (@@)"
        >
          @@
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
        <ImagePicker
          onEmbed={insertImageUrl}
          onAddSticker={handleAddSticker}
          onError={setError}
          initialFile={sharedImageFile}
          onInitialFileProcessed={onSharedImageProcessed}
        />
        <DrawingPicker onEmbed={insertImageUrl} onAddSticker={handleAddSticker} />
        <VoicePicker onComplete={insertImageUrl} />
        <LocationPicker
          onSelect={(geohash, name) => setLocations([...locations, { geohash, name }])}
          currentLocations={locations}
        />
        {content.length > LIMITS.FOLD_THRESHOLD && (
          <button
            ref={teaserButtonRef}
            type="button"
            className={`teaser-button ${teaserColor ? 'active' : ''}`}
            onClick={() => setShowTeaserPicker(true)}
            title="Teaser"
          >
            <span style={teaserColor ? { color: STELLA_COLORS[teaserColor].hex } : undefined}>
              <Icon name="Lock" size={16} />
            </span>
          </button>
        )}
      </div>

      <ShortTextEditor
        ref={shortTextEditorRef}
        content={content}
        onContentChange={onContentChange}
        onSuperMentionTrigger={() => setShowSuperMentionPopup(true)}
        placeholder={stickers.length > 0 ? '投稿するには1文字以上必要です' : 'マイペースで書こう'}
      />

      <AttachedImages imageUrls={imageUrls} onRemove={handleRemoveImage} />
      <AttachedLocations
        locations={locations}
        onRemove={(index) => setLocations(locations.filter((_, i) => i !== index))}
      />

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
          locations={locations}
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
          onSelect={(text) => shortTextEditorRef.current?.insertText(text + '\n')}
          onClose={() => setShowSuperMentionPopup(false)}
        />
      )}

      {showTeaserPicker && (
        <TeaserPicker
          selectedColor={teaserColor}
          onSelect={(color) => {
            setTeaserColor(color)
            setShowTeaserPicker(false)
          }}
          onClose={() => setShowTeaserPicker(false)}
        />
      )}
    </form>
  )
}
