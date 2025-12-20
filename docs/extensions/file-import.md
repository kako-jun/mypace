# File Import

Import local markdown/text files into the post editor.

## Overview

A file import button allows loading `.md` or `.txt` files directly into the editor without auto-posting.

## UI Location

The import button appears next to the avatar in the post form:

```
┌─ Post Form ─────────────────────────────┐
│ [Avatar] [📁] [@@] [📷] [🎨] [LONG ↗] [-]│
│ ┌─────────────────────────────────────┐ │
│ │ Text area...                        │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Note:** The import button only appears when the editor is empty. It disappears when content is typed.

## Supported Formats

| Extension | MIME Type |
|-----------|-----------|
| `.md` | text/markdown |
| `.txt` | text/plain |
| `.markdown` | text/markdown |

## Behavior

1. Click the file import button (FileUp icon)
2. File picker opens
3. Select a `.md` or `.txt` file
4. Content is loaded into the editor
5. User reviews and edits as needed
6. User manually posts when ready

**Important:** Files are NOT auto-posted. This allows reviewing and editing before publishing.

## Implementation

```typescript
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
```

```tsx
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
```

## Works In

- Short mode editor
- Long mode editor

## Use Cases

- Load pre-written articles
- Import drafts from other editors
- Post from markdown files in your knowledge base
- Copy content from Obsidian, Notion exports, etc.

## Related

- [share.md](./share.md) - Export posts as markdown
