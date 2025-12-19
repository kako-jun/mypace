import { getThemeCardProps } from '../../lib/nostr/events'
import { PostContent } from './PostContent'
import { PostStickers } from './PostStickers'
import type { ThemeColors, EmojiTag, Sticker } from '../../types'

interface PostPreviewProps {
  content: string
  themeColors: ThemeColors | null
  transparentBackground?: boolean
  emojis?: EmojiTag[]
  stickers?: Sticker[]
  editableStickers?: boolean
  onStickerMove?: (index: number, x: number, y: number) => void
  onStickerResize?: (index: number, size: number) => void
  onStickerRotate?: (index: number, rotation: number) => void
}

export default function PostPreview({
  content,
  themeColors,
  transparentBackground = false,
  emojis = [],
  stickers = [],
  editableStickers = false,
  onStickerMove,
  onStickerResize,
  onStickerRotate,
}: PostPreviewProps) {
  if (!content.trim()) return null

  const themeProps = getThemeCardProps(themeColors)

  return (
    <div className={`post-preview ${themeProps.className}`} style={transparentBackground ? {} : themeProps.style}>
      <div className="preview-label">Preview</div>
      <div className="preview-content">
        <PostContent content={content} emojis={emojis} />
      </div>
      <PostStickers
        stickers={stickers}
        editable={editableStickers}
        onStickerMove={onStickerMove}
        onStickerResize={onStickerResize}
        onStickerRotate={onStickerRotate}
      />
    </div>
  )
}
