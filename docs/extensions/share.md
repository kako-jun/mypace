# Share Menu

Extended share functionality for posts.

## Overview

The share button opens a two-tier menu with URL sharing and content sharing options.

## Menu Structure

```
[Share]
  ├─ Share URL
  └─ Share Content →
        ├─ Copy Markdown
        ├─ Open Markdown URL
        └─ Download Markdown
```

## Options

### Share URL

Same behavior as traditional share:
- Mobile: Opens native share dialog (Web Share API)
- Desktop: Copies URL to clipboard

### Share Content

#### Copy Markdown

Copies the post content as plain text to clipboard.
- Includes teaser expansion (full content for long posts)

#### Open Markdown URL

Opens the raw content URL in a new tab:
```
https://api.mypace.llll-ll.com/raw/{eventId}
```

This URL can be shared with others to view the plain text content.

#### Download Markdown

Downloads the content as a `.md` file:
- Filename: `{eventId}.md`
- Encoding: UTF-8 with BOM (for Windows compatibility)
- Content: Full post text with teaser expanded

## API Endpoint

### GET /raw/:id

Returns the full plain text content of a post.

**Features:**
- Expands teaser content (removes READ MORE link, appends hidden content)
- Returns `text/plain; charset=utf-8`
- Fetches from cache or relays

**Example:**
```bash
curl https://api.mypace.llll-ll.com/raw/abc123...
```

**Response:**
```
The full post content here...
Including any teaser-hidden text.
```

## Implementation

### Frontend

```typescript
// clipboard.ts
export function downloadAsMarkdown(content: string, filename: string): void {
  const bom = new Uint8Array([0xef, 0xbb, 0xbf])
  const blob = new Blob([bom, content], { type: 'text/markdown;charset=utf-8' })
  // ... download logic
}

export function openRawUrl(eventId: string): void {
  const rawUrl = `${API_BASE}/raw/${eventId}`
  window.open(rawUrl, '_blank')
}
```

### API

```typescript
// routes/raw.ts
function getFullContent(content: string, tags: string[][]): string {
  const teaserContent = getTeaserContent(tags)
  if (!teaserContent) return content
  return removeReadMoreLink(content) + teaserContent
}
```

## Related

- [teaser.md](./teaser.md) - Long post folding system
