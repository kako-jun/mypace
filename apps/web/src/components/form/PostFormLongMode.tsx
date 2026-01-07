import { useRef, useState, useCallback } from 'react'
import type { ThemeColors, EmojiTag, Sticker, Event, StickerQuadrant, StickerLayer, Profile } from '../../types'
import { ImageDropZone, AttachedImages, AttachedLocations, PostPreview } from '../post'
import { LongModeEditor, type LongModeEditorRef } from './LongModeEditor'
import { Toggle, Avatar, TextButton, ErrorMessage, Icon } from '../ui'
import { StickerPicker } from '../sticker'
import { SuperMentionPopup } from '../superMention'
import { LocationPicker } from '../location'
import { DrawingPicker } from '../drawing'
import { VoicePicker } from '../voice'
import { FormActions } from './FormActions'
import { getDisplayName } from '../../lib/utils'

interface PostFormLongModeProps {
  content: string
  onContentChange: (content: string) => void
  showPreview: boolean
  onShowPreviewChange: (show: boolean) => void
  editingEvent?: Event | null
  replyingTo?: Event | null
  replyToProfile?: Profile | null
  posting: boolean
  error: string
  vimMode: boolean
  onVimModeChange: (enabled: boolean) => void
  darkTheme: boolean
  themeColors: ThemeColors | null
  myAvatarUrl?: string
  myEmojis: EmojiTag[]
  imageUrls: string[]
  stickers: Sticker[]
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  onLongModeToggle: () => void
  onAvatarClick: () => void
  onRemoveImage: (url: string) => void
  onError: (error: string) => void
  onAddSticker: (sticker: Omit<Sticker, 'x' | 'y' | 'size' | 'rotation' | 'quadrant'>) => void
  onRemoveSticker: (index: number) => void
  onStickerMove: (index: number, x: number, y: number, quadrant: StickerQuadrant) => void
  onStickerResize: (index: number, size: number) => void
  onStickerRotate: (index: number, rotation: number) => void
  onStickerLayerChange: (index: number, layer: StickerLayer) => void
  locations: { geohash: string; name?: string }[]
  onLocationsChange: (locations: { geohash: string; name?: string }[]) => void
}

export function PostFormLongMode({
  content,
  onContentChange,
  showPreview,
  onShowPreviewChange,
  editingEvent,
  replyingTo,
  replyToProfile,
  posting,
  error,
  vimMode,
  onVimModeChange,
  darkTheme,
  themeColors,
  myAvatarUrl,
  myEmojis,
  imageUrls,
  stickers,
  onSubmit,
  onCancel,
  onLongModeToggle,
  onAvatarClick,
  onRemoveImage,
  onError,
  onAddSticker,
  onRemoveSticker,
  onStickerMove,
  onStickerResize,
  onStickerRotate,
  onStickerLayerChange,
  locations,
  onLocationsChange,
}: PostFormLongModeProps) {
  const longModeFormRef = useRef<HTMLFormElement>(null)
  const editorRef = useRef<LongModeEditorRef>(null)
  const fileImportRef = useRef<HTMLInputElement>(null)
  const [showSuperMentionPopup, setShowSuperMentionPopup] = useState(false)

  const handleInsertToEditor = (text: string) => {
    editorRef.current?.insertText(text)
  }

  const handleFileImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        onContentChange(text)
      } catch {
        onError('Failed to read file')
      }

      e.target.value = ''
    },
    [onContentChange, onError]
  )

  return (
    <div className={`long-mode-container ${showPreview ? 'with-preview' : 'no-preview'}`}>
      <TextButton variant="primary" className="long-mode-exit-button" onClick={onLongModeToggle}>
        ↙ SHORT
      </TextButton>

      <div className="long-mode-editor-pane">
        <form
          ref={longModeFormRef}
          className={`post-form long-mode ${editingEvent ? 'editing' : ''} ${replyingTo ? 'replying' : ''} ${content.trim() ? 'active' : ''}`}
          onSubmit={onSubmit}
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
                    <div className="editing-label">Editing post...</div>
                  </>
                )
              }
              return <div className="editing-label">Editing post...</div>
            })()}
          {replyingTo && (
            <div className="replying-label">
              <span>Reply</span>
              <span className="reply-to-name">→ @{getDisplayName(replyToProfile, replyingTo.pubkey)}</span>
            </div>
          )}

          <div className="post-form-row-1">
            <button type="button" className="post-form-avatar-button" onClick={onAvatarClick}>
              <Avatar src={myAvatarUrl} size="small" className="post-form-avatar" />
            </button>
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
            <div className="post-form-spacer" />
            <div className="vim-toggle">
              <Toggle checked={vimMode} onChange={onVimModeChange} label="Vim" />
            </div>
          </div>

          <div className="post-form-row-2">
            <ImageDropZone onImageUploaded={handleInsertToEditor} onError={onError} />
            <StickerPicker onAddSticker={onAddSticker} />
            <DrawingPicker onComplete={handleInsertToEditor} />
            <VoicePicker onComplete={handleInsertToEditor} />
            <LocationPicker
              onSelect={(geohash, name) => onLocationsChange([...locations, { geohash, name }])}
              currentLocations={locations}
            />
          </div>

          <LongModeEditor
            ref={editorRef}
            value={content}
            onChange={onContentChange}
            placeholder="マイペースで書こう"
            vimMode={vimMode}
            darkTheme={darkTheme}
            onWrite={() => longModeFormRef.current?.requestSubmit()}
            onQuit={onLongModeToggle}
            onSuperMentionTrigger={() => setShowSuperMentionPopup(true)}
          />

          <AttachedImages imageUrls={imageUrls} onRemove={onRemoveImage} />
          <AttachedLocations
            locations={locations}
            onRemove={(index) => onLocationsChange(locations.filter((_, i) => i !== index))}
          />

          <FormActions
            content={content}
            posting={posting}
            showPreview={showPreview}
            onShowPreviewChange={onShowPreviewChange}
            editingEvent={editingEvent}
            replyingTo={replyingTo}
            onCancel={onCancel}
          />

          <ErrorMessage>{error}</ErrorMessage>
        </form>
      </div>

      {showPreview && (
        <div className="long-mode-preview-pane">
          <PostPreview
            content={content}
            themeColors={themeColors}
            transparentBackground
            emojis={myEmojis}
            stickers={stickers}
            editableStickers
            onStickerMove={onStickerMove}
            onStickerResize={onStickerResize}
            onStickerRotate={onStickerRotate}
            onStickerLayerChange={onStickerLayerChange}
            onStickerRemove={onRemoveSticker}
            locations={locations}
          />
        </div>
      )}

      {showSuperMentionPopup && (
        <SuperMentionPopup onSelect={handleInsertToEditor} onClose={() => setShowSuperMentionPopup(false)} />
      )}
    </div>
  )
}
