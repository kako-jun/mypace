# Markdownダウンロード機能計画

## 概要

投稿をMarkdownファイルとしてローカルにダウンロードできる機能。
プログラマーやAI活用者向け。

## 背景

- AIに食わせるにはMarkdown形式が便利
- ローカルに保存してナレッジベースに追加したい
- 既存のシェア機能（URL共有）の拡張

## 機能

### シェアメニューの拡張

現在:
- URLをクリップボードにコピー

追加:
- Markdownとしてダウンロード

```
[シェアボタン] → メニュー展開
  ├─ 📋 URLをコピー（既存）
  └─ 📥 MDでダウンロード（新規）
```

### ダウンロードされるMarkdownの形式

```markdown
# 投稿

**Author:** @username (npub1xxx...)
**Date:** 2025-01-15 14:30:00
**URL:** https://mypace.example.com/post/xxx

---

投稿の本文がここに入る。

画像があれば:
![image](https://example.com/image.jpg)

ハッシュタグ: #mypace #nostr

---

**Event ID:** xxx
**Kind:** 1
**Pubkey:** xxx
```

### ファイル名

```
mypace_{eventId_short}_{timestamp}.md
```

例: `mypace_abc123_20250115.md`

## 実装

### ダウンロード関数

```typescript
function downloadPostAsMarkdown(event: Event, profile: Profile | null) {
  const displayName = profile?.name || profile?.display_name || 'Anonymous'
  const npub = nip19.npubEncode(event.pubkey)
  const date = new Date(event.created_at * 1000).toLocaleString()
  const url = `${window.location.origin}/post/${event.id}`

  // ハッシュタグ抽出
  const hashtags = event.tags
    .filter(t => t[0] === 't')
    .map(t => `#${t[1]}`)
    .join(' ')

  const markdown = `# 投稿

**Author:** @${displayName} (${npub})
**Date:** ${date}
**URL:** ${url}

---

${event.content}

${hashtags ? `\nハッシュタグ: ${hashtags}` : ''}

---

**Event ID:** ${event.id}
**Kind:** ${event.kind}
**Pubkey:** ${event.pubkey}
`

  const blob = new Blob([markdown], { type: 'text/markdown' })
  const downloadUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = `mypace_${event.id.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(downloadUrl)
}
```

### UIの変更

```tsx
// シェアボタンをドロップダウンに変更
<div className="share-dropdown">
  <button className="share-button" onClick={toggleMenu}>
    <Icon name="Share2" />
  </button>
  {menuOpen && (
    <div className="share-menu">
      <button onClick={handleCopyUrl}>
        <Icon name="Link" /> URLをコピー
      </button>
      <button onClick={handleDownloadMd}>
        <Icon name="Download" /> MDでダウンロード
      </button>
    </div>
  )}
</div>
```

## 拡張案

### 複数投稿の一括ダウンロード

- タイムラインで複数選択
- まとめて1つのMDファイルに
- または個別MDのZIPダウンロード

### スレッド全体のダウンロード

- 投稿詳細画面で「スレッドごとダウンロード」
- 元投稿 + 全返信を1つのMDに

### カスタムテンプレート

- ダウンロード形式をカスタマイズ
- 必要なメタデータだけ選択
- YAML frontmatter形式オプション

```yaml
---
title: 投稿タイトル
author: @username
date: 2025-01-15
tags: [mypace, nostr]
---

本文...
```

## 他の用途

- Obsidianなどのノートアプリに追加
- GitHub/GitLabのissueに貼り付け
- AI（ChatGPT、Claude）に食わせる
- ブログ記事の素材として保存
- 自分の投稿のバックアップ

## 実装優先度

1. 基本ダウンロード機能
2. シェアメニューUI
3. スレッドごとダウンロード
4. 一括ダウンロード
5. カスタムテンプレート
