import { getThemeCardProps } from '../../lib/nostr/events'
import { PostContent } from './PostContent'
import { PostStickers } from './PostStickers'
import { PostLocation } from './PostLocation'
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
  locations?: { geohash: string; name?: string }[]
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
  locations = [],
}: PostPreviewProps) {
  if (!content.trim()) return null

  const themeProps = getThemeCardProps(themeColors)

  const hasStickers = stickers.length > 0

  return (
    <div className={`post-preview ${themeProps.className}`} style={transparentBackground ? {} : themeProps.style}>
      {/* Back layer stickers - behind content */}
      <PostStickers
        stickers={stickers}
        layer="back"
        editable={editableStickers}
        onStickerMove={onStickerMove}
        onStickerResize={onStickerResize}
        onStickerRotate={onStickerRotate}
        onStickerLayerChange={onStickerLayerChange}
        onStickerRemove={onStickerRemove}
      />
      {/* Header skeleton - only shown when stickers exist */}
      {hasStickers && (
        <div className="preview-header-skeleton" style={editableStickers ? { pointerEvents: 'none' } : undefined}>
          <div className="preview-avatar-skeleton" />
          <div className="preview-author-skeleton">
            <div className="preview-name-skeleton" />
            <div className="preview-time-skeleton" />
          </div>
        </div>
      )}
      <div className="preview-content" style={editableStickers ? { pointerEvents: 'none' } : undefined}>
        <PostContent content={content} emojis={emojis} />
      </div>
      {locations.map((loc, i) => (
        <PostLocation key={i} geohashStr={loc.geohash} name={loc.name} />
      ))}
      {/* Footer skeleton - only shown when stickers exist */}
      {hasStickers && (
        <div className="preview-footer-skeleton" style={editableStickers ? { pointerEvents: 'none' } : undefined}>
          <div className="preview-action-skeleton" />
          <div className="preview-action-skeleton" />
          <div className="preview-action-skeleton" />
          <div className="preview-action-skeleton" />
        </div>
      )}
      {/* Front layer stickers - above content */}
      <PostStickers
        stickers={stickers}
        layer="front"
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
