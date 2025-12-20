import { useRef, useState } from 'react'
import type { ThemeColors, EmojiTag, Sticker, Event } from '../../types'
import { ImageDropZone, AttachedImages, PostPreview } from '../post'
import { LongModeEditor, type LongModeEditorRef } from './LongModeEditor'
import { Toggle, Avatar, TextButton, ErrorMessage } from '../ui'
import { StickerPicker, StickerList } from '../sticker'
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
  onAddSticker: (sticker: Omit<Sticker, 'x' | 'y' | 'size' | 'rotation'>) => void
  onRemoveSticker: (index: number) => void
  onStickerMove: (index: number, x: number, y: number) => void
  onStickerResize: (index: number, size: number) => void
  onStickerRotate: (index: number, rotation: number) => void
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
}: PostFormLongModeProps) {
  const longModeFormRef = useRef<HTMLFormElement>(null)
  const editorRef = useRef<LongModeEditorRef>(null)
  const [showSuperMentionPopup, setShowSuperMentionPopup] = useState(false)

  const handleInsertToEditor = (text: string) => {
    editorRef.current?.insertText(text)
  }

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
            <button
              type="button"
              className="super-mention-button"
              onClick={() => setShowSuperMentionPopup(true)}
              title="Super Mention (@/)"
            >
              @/
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
          <StickerList stickers={stickers} onRemove={onRemoveSticker} />

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
          />
        </div>
      )}

      {showSuperMentionPopup && (
        <SuperMentionPopup onSelect={handleInsertToEditor} onClose={() => setShowSuperMentionPopup(false)} />
      )}
    </div>
  )
}
