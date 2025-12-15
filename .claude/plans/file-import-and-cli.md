# ファイルインポート & CLI機能計画

## 概要

ローカルのMarkdown/テキストファイルから投稿できる機能。
Web UIとCLIの両方で対応。

## 機能1: ファイルインポートボタン（Web UI）

### コンセプト

- 投稿エディタに「ファイルから読み込み」ボタン
- ローカルの .md / .txt を選択
- エディタに内容が読み込まれる
- **勝手に投稿しない**（確認してから投稿）

### Qiita/Zennにない利点

- CLIインストール不要
- ブラウザだけで完結
- 非プログラマーでも使える
- ドラッグ&ドロップも可能

### UI

```
┌─ 投稿エディタ ──────────────────────┐
│                                     │
│ [📎 ファイルから読み込み]            │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │  ここにテキストが読み込まれる     │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [プレビュー]              [投稿]    │
└─────────────────────────────────────┘
```

### ドラッグ&ドロップ対応

```
┌─────────────────────────────────────┐
│                                     │
│    📄 ファイルをドロップして        │
│       読み込み                      │
│                                     │
└─────────────────────────────────────┘
```

### 実装

```typescript
function handleFileImport(file: File) {
  const reader = new FileReader()
  reader.onload = (e) => {
    const content = e.target?.result as string
    setEditorContent(content)
  }
  reader.readAsText(file)
}

// input要素
<input
  type="file"
  accept=".md,.txt,.markdown"
  onChange={(e) => {
    const file = e.target.files?.[0]
    if (file) handleFileImport(file)
  }}
/>

// ドラッグ&ドロップ
<div
  onDragOver={(e) => e.preventDefault()}
  onDrop={(e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileImport(file)
  }}
>
```

### 対応ファイル形式

| 拡張子 | 処理 |
|--------|------|
| .md | そのまま読み込み |
| .markdown | そのまま読み込み |
| .txt | そのまま読み込み |

### ファイル読み込み後の確認

```
📄 "旅行記.md" を読み込みました (1,234文字)

内容を確認してから投稿してください。
```

## 機能2: mypace CLI（玄人向け）

### コンセプト

- コマンドラインから投稿
- Qiita CLI / Zenn CLI のような使い勝手
- スクリプトやCI/CDとの連携

### インストール

```bash
npm install -g @mypace/cli
# または
pnpm add -g @mypace/cli
```

### 初期設定

```bash
mypace login
# ブラウザが開いてNIP-07認証
# または秘密鍵を直接入力（nsec）
```

### コマンド

```bash
# ファイルから投稿
mypace post ./article.md

# 標準入力から投稿
echo "Hello World" | mypace post -

# プレビュー（投稿しない）
mypace post ./article.md --dry-run

# 下書き保存
mypace draft ./article.md

# ハッシュタグ追加
mypace post ./article.md --tags "mypace,travel"

# 位置情報追加
mypace post ./article.md --location "35.0116,135.7681"
```

### 設定ファイル

`~/.mypace/config.json`
```json
{
  "relays": [
    "wss://relay.damus.io",
    "wss://relay.nostr.band"
  ],
  "defaultTags": ["mypace"],
  "privateKey": "nsec1..." // 暗号化保存
}
```

### 投稿ファイル形式（YAML frontmatter）

```markdown
---
tags: [mypace, travel, 京都]
location: [35.0116, 135.7681, "京都市"]
stickers:
  - url: https://example.com/pop.png
    x: 85
    y: 10
    size: 20
---

# 京都旅行記

今日は京都に来ました...
```

### CLI実装構成

```
packages/
  cli/
    src/
      index.ts        # エントリーポイント
      commands/
        post.ts       # 投稿コマンド
        draft.ts      # 下書きコマンド
        login.ts      # ログインコマンド
      lib/
        nostr.ts      # Nostr署名・送信
        config.ts     # 設定管理
```

## 優先度

### Phase 1: ファイルインポートボタン
- 簡単に実装可能
- 多くのユーザーに恩恵
- CLIより先にリリース

### Phase 2: CLI基本機能
- post コマンド
- login コマンド
- 設定ファイル

### Phase 3: CLI拡張
- frontmatter対応
- ドライラン
- タグ・位置情報オプション

## 競合との比較

| 機能 | Qiita | Zenn | mypace |
|------|-------|------|--------|
| CLI投稿 | ✓ | ✓ | ✓ (予定) |
| Webからファイル読み込み | ✗ | ✗ | ✓ (予定) |
| ドラッグ&ドロップ | ✗ | ✗ | ✓ (予定) |
| 分散型 | ✗ | ✗ | ✓ |
| 検閲耐性 | ✗ | ✗ | ✓ |
