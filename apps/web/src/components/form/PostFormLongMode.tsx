import { useRef, useState, useCallback } from 'react'
import type { ThemeColors, EmojiTag, Sticker, Event, StickerQuadrant, StickerLayer } from '../../types'
import { ImageDropZone, AttachedImages, PostPreview } from '../post'
import { LongModeEditor, type LongModeEditorRef } from './LongModeEditor'
import { Toggle, Avatar, TextButton, ErrorMessage, Icon } from '../ui'
import { StickerPicker } from '../sticker'
import { SuperMentionPopup } from '../superMention'
import { FormActions } from './FormActions'

interface PostFormLongModeProps {
  content: string
  onContentChange: (content: string) => void
  showPreview: boolean
  onShowPreviewChange: (show: boolean) => void
  editingEvent?: Event | null
  replyingTo?: Event | null
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
}

export function PostFormLongMode({
  content,
  onContentChange,
  showPreview,
  onShowPreviewChange,
  editingEvent,
  replyingTo,
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
          {editingEvent && <div className="editing-label">Editing post...</div>}
          {replyingTo && <div className="replying-label">Replying to post...</div>}

          <div className="post-form-top-actions">
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
            <ImageDropZone onImageUploaded={handleInsertToEditor} onError={onError} />
            <StickerPicker onAddSticker={onAddSticker} />
            <div className="vim-toggle">
              <Toggle checked={vimMode} onChange={onVimModeChange} label="Vim" />
            </div>
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
          />
        </div>
      )}

      {showSuperMentionPopup && (
        <SuperMentionPopup onSelect={handleInsertToEditor} onClose={() => setShowSuperMentionPopup(false)} />
      )}
    </div>
  )
}
