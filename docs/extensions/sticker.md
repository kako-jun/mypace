# sticker

Post card stickers - freely positionable images on posts.

## Background

- LINE sticker culture inspiration
- Village Vanguard-style cheap POP aesthetic
- Visual accents for posts

## Tag Format

```json
["sticker", "<url>", "<x>", "<y>", "<size>", "<rotation>", "<quadrant>"]
```

- **url**: Sticker image URL
- **x**: Position within quadrant (0-100%)
- **y**: Position within quadrant (0-100%)
- **size**: Width (5-100%)
- **rotation**: Rotation angle (0-360 degrees)
- **quadrant**: Anchor corner (`top-left`, `top-right`, `bottom-left`, `bottom-right`)

## Quadrant System

Stickers are positioned relative to one of four corners:

```
┌───────────┬───────────┐
│ top-left  │ top-right │
├───────────┼───────────┤
│bottom-left│bottom-right│
└───────────┴───────────┘
```

When dragging a sticker across the center of the card, it snaps to the nearest quadrant. This ensures stickers maintain their relative position regardless of card size.

## Event Format

Kind 1 with `sticker` tags:

```json
{
  "kind": 1,
  "content": "New product announcement",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://example.com/new-label.png", "85", "5", "20", "15", "top-right"]
  ]
}
```

Multiple stickers:

```json
{
  "kind": 1,
  "content": "Special sale!",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://example.com/sale.png", "80", "10", "25", "0", "top-right"],
    ["sticker", "https://example.com/limited.png", "5", "5", "18", "45", "top-left"]
  ]
}
```

## Sticker Type

```typescript
type StickerQuadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface Sticker {
  url: string           // Image URL
  x: number             // Position within quadrant (0-100%)
  y: number             // Position within quadrant (0-100%)
  size: number          // Width (5-100%)
  rotation: number      // Rotation angle (0-360 degrees)
  quadrant: StickerQuadrant  // Anchor corner
}
```

## Tag Parsing

```typescript
function parseStickers(tags: string[][]): Sticker[] {
  const validQuadrants = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  return tags
    .filter((t) => t[0] === 'sticker' && t.length >= 5)
    .map((t) => ({
      url: t[1],
      x: Math.max(0, Math.min(100, parseInt(t[2], 10) || 0)),
      y: Math.max(0, Math.min(100, parseInt(t[3], 10) || 0)),
      size: Math.max(5, Math.min(100, parseInt(t[4], 10) || 15)),
      rotation: t[5] ? Math.max(0, Math.min(360, parseInt(t[5], 10) || 0)) : 0,
      quadrant: validQuadrants.includes(t[6]) ? t[6] : 'top-left',
    }))
    .filter((s) => s.url)
}
```

## Post UI

### Sticker Selection

1. Click sticker icon in editor top actions
2. Modal shows sticker history (most used first)
3. Enter URL for custom sticker
4. Selected sticker appears at center of preview

### Photoshop-style Editing

When a sticker is selected:

- **Bounding box**: Blue dashed border
- **Resize handles**: Blue circles at corners
- **Rotation handle**: Green circle above center
- **Drag**: Move sticker position
- **Deselect**: Click outside or press ESC

### Controls

- Mouse and touch support
- Larger handles on mobile
- Position clamped to 0-100%
- Maximum 10 stickers per post

## Sticker History

Server-side tracking of sticker usage:

```sql
CREATE TABLE sticker_history (
  url TEXT PRIMARY KEY,
  first_used_by TEXT,      -- npub of first user
  use_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

API Endpoints:
- `GET /api/stickers/history` - Get popular stickers
- `POST /api/stickers/history` - Record sticker usage

## Component Structure

```
PostStickers (display/edit)
├── sticker-wrapper (position/rotation/size)
│   ├── post-sticker (image)
│   ├── sticker-bbox (bounding box)
│   ├── sticker-handle-resize × 4 (corners)
│   ├── sticker-rotate-line
│   └── sticker-handle-rotate
```

## Usage Locations

- **Timeline**: TimelinePostCard → PostStickers (display only)
- **Detail page**: PostView → PostStickers (display only)
- **Post preview**: PostPreview → PostStickers (editable)
- **Edit mode**: Restore existing stickers, reposition

## Other Clients

Sticker tags are MyPace-specific. Other Nostr clients ignore them and show only the text content.

## Future

- Custom sticker upload
- Sticker collection sharing
- Zap-based sticker economy
