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

### クリックでインポート
1. Click the file import button (FileUp icon)
2. File picker opens
3. Select a `.md` or `.txt` file
4. Content is loaded into the editor
5. User reviews and edits as needed
6. User manually posts when ready

### ドラッグ＆ドロップでインポート
1. `.md` or `.txt` file をインポートボタンにドラッグ
2. ボタンの枠線が破線から色付き実線に変化（ドロップ可能を示す）
3. ファイルをドロップ
4. Content is loaded into the editor

**Important:** Files are NOT auto-posted. This allows reviewing and editing before publishing.

## Implementation

```typescript
// ファイル処理（クリック・ドラッグ共通）
const processFileImport = useCallback(
  async (file: File) => {
    const validTypes = ['text/plain', 'text/markdown', '']
    const validExtensions = ['.txt', '.md', '.markdown']
    const hasValidExt = validExtensions.some((ext) => file.name.toLowerCase().endsWith(ext))
    if (!validTypes.includes(file.type) && !hasValidExt) {
      onError('Please drop a .txt or .md file')
      return
    }
    try {
      const text = await file.text()
      onContentChange(text)
    } catch {
      onError('Failed to read file')
    }
  },
  [onContentChange, onError]
)

// ドラッグ＆ドロップ対応
const { dragging: fileImportDragging, handlers: fileImportHandlers } = useDragDrop(processFileImport)
```

```tsx
{!content && (
  <label
    className={`file-import-area ${fileImportDragging ? 'dragging' : ''}`}
    title="Import text file"
    onDragOver={fileImportHandlers.onDragOver}
    onDragLeave={fileImportHandlers.onDragLeave}
    onDrop={fileImportHandlers.onDrop}
  >
    <Icon name="FileUp" size={16} />
    <input
      ref={fileImportRef}
      type="file"
      accept=".md,.txt,text/markdown,text/plain"
      onChange={handleFileImport}
      style={{ display: 'none' }}
    />
  </label>
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
