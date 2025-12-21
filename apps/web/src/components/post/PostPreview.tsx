import { getThemeCardProps } from '../../lib/nostr/events'
import { PostContent } from './PostContent'
import { PostStickers } from './PostStickers'
import type { ThemeColors, EmojiTag, Sticker, StickerQuadrant, StickerLayer } from '../../types'

interface PostPreviewProps {
  content: string
  themeColors: ThemeColors | null
  transparentBackground?: boolean
  emojis?: EmojiTag[]
  stickers?: Sticker[]
  editableStickers?: boolean
  onStickerMove?: (index: number, x: number, y: number, quadrant: StickerQuadrant) => void
  onStickerResize?: (index: number, size: number) => void
  onStickerRotate?: (index: number, rotation: number) => void
  onStickerLayerChange?: (index: number, layer: StickerLayer) => void
  onStickerRemove?: (index: number) => void
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
  onStickerLayerChange,
  onStickerRemove,
}: PostPreviewProps) {
  if (!content.trim()) return null

  const themeProps = getThemeCardProps(themeColors)

  const hasStickers = stickers.length > 0

  return (
    <div className={`post-preview ${themeProps.className}`} style={transparentBackground ? {} : themeProps.style}>
      {/* Header skeleton - only shown when stickers exist */}
      {hasStickers && (
        <div className="preview-header-skeleton">
          <div className="preview-avatar-skeleton" />
          <div className="preview-author-skeleton">
            <div className="preview-name-skeleton" />
            <div className="preview-time-skeleton" />
          </div>
        </div>
      )}
      <div className="preview-content">
        <PostContent content={content} emojis={emojis} />
      </div>
      {/* Footer skeleton - only shown when stickers exist */}
      {hasStickers && (
        <div className="preview-footer-skeleton">
          <div className="preview-action-skeleton" />
          <div className="preview-action-skeleton" />
          <div className="preview-action-skeleton" />
          <div className="preview-action-skeleton" />
        </div>
      )}
      <PostStickers
        stickers={stickers}
        editable={editableStickers}
        onStickerMove={onStickerMove}
        onStickerResize={onStickerResize}
        onStickerRotate={onStickerRotate}
        onStickerLayerChange={onStickerLayerChange}
        onStickerRemove={onStickerRemove}
      />
    </div>
  )
}
