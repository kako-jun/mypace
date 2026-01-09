# Embed Card (Web Components)

Embed MYPACE post cards on external websites.

## Overview

Provides a `<mypace-card>` custom element that displays a post card on any website. Uses iframe internally to reuse existing React components, ensuring the embedded card looks identical to cards on MYPACE.

## Usage

```html
<!-- Load the script -->
<script src="https://mypace.llll-ll.com/embed.js"></script>

<!-- Specific post by note ID -->
<mypace-card note="note1abc..."></mypace-card>

<!-- Latest post -->
<mypace-card latest></mypace-card>

<!-- Latest post from specific user -->
<mypace-card latest pubkey="npub1..."></mypace-card>
```

## Attributes

| Attribute | Description |
|-----------|-------------|
| `note` | Note ID (note1... or hex) to display |
| `latest` | Show the latest post (no value needed) |
| `pubkey` | User pubkey (npub1... or hex) to filter latest post |
| `theme` | `light` or `dark` (default: `light`) |

## Styling

Default: `max-width: 500px; display: block;`

Override with `style` attribute:
```html
<mypace-card note="..." style="max-width: 400px;"></mypace-card>
<mypace-card note="..." style="max-width: 100%;"></mypace-card>
```

## Architecture

```
External Site
    │
    ├─ <script src="https://mypace.llll-ll.com/embed.js">
    │
    └─ <mypace-card note="...">
           │
           │ connectedCallback()
           ▼
       <iframe src="https://mypace.llll-ll.com/embed/note1...">
           │
           ▼
       EmbedPage.tsx (React)
           │
           ▼
       Existing components: PostHeader, PostContent, PostStickers, etc.
```

## Card Features

The embedded card displays:
- Author avatar with black-bordered white text name
- Post content with super-mentions
- Stickers (positioned as in original)
- Corner gradient colors (mypace theme)
- Timestamp

**Not included:**
- Reaction buttons (like, reply, repost)
- Edit/delete buttons

**Click behavior:**
Clicking anywhere on the card opens the full post on mypace.llll-ll.com in a new tab.

## Implementation

### Files

| File | Location | Role |
|------|----------|------|
| `embed.js` | `apps/web/public/` | Web Component (generates iframe) |
| `EmbedPage.tsx` | `apps/web/src/pages/` | Embed page using existing components |
| `embed-card.css` | `apps/web/src/styles/components/` | Embed-specific styles |

### Web Component (embed.js)

```javascript
class MypaceCard extends HTMLElement {
  connectedCallback() {
    const noteId = this.getAttribute('note')
    const isLatest = this.hasAttribute('latest')
    const theme = this.getAttribute('theme') || 'light'

    // Default styles (can be overridden)
    if (!this.style.display) this.style.display = 'block'
    if (!this.style.maxWidth) this.style.maxWidth = '500px'

    const src = isLatest
      ? `https://mypace.llll-ll.com/embed/latest?theme=${theme}`
      : `https://mypace.llll-ll.com/embed/${noteId}?theme=${theme}`

    const iframe = document.createElement('iframe')
    iframe.src = src
    iframe.style.cssText = 'border:none; width:100%; min-height:200px;'
    this.appendChild(iframe)

    // Height auto-adjusts via postMessage from iframe
  }
}

customElements.define('mypace-card', MypaceCard)
```

### Routing

```
/embed/:noteId → EmbedPage
```

## Styling

The embed page:
- Uses existing post-card.css
- Card width follows outer container (no internal max-width constraint)
- Removes hover effects (no drop-shadow on hover)
- Entire card is clickable
- Supports light/dark theme via query parameter

## Related

- [share.md](./share.md) - Share menu functionality
