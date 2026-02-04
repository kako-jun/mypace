# Shared Article Quote（共有記事引用）

外部記事URLを共通の「記者アカウント」で引用投稿し、複数ユーザーの感想をスレッドとして集約する機能。

## 概要

従来のIntent Share（`/intent/post`）では、各ユーザーが個別に記事URLを自分の投稿に埋め込んでいた。これでは同じ記事への感想が散在し、議論が生まれにくい。

Shared Article Quoteでは：
- **記者アカウント**が記事を代表して引用投稿
- ユーザーはその引用投稿への**リプライ**として感想を投稿（既存のリプライ機能）
- 同じ記事への感想が**1つのスレッド**に集約される

はてなブックマークの「ファーストブクマ」や、スレッド掲示板のように、誰でも記事を引用させ、感想スレッドの起点を作れる。

## コンセプト図

```
従来（Intent Share）:
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ ユーザーA     │  │ ユーザーB     │  │ ユーザーC     │
│ 記事URL      │  │ 記事URL      │  │ 記事URL      │
│ 感想...      │  │ 感想...      │  │ 感想...      │
└──────────────┘  └──────────────┘  └──────────────┘
      ↑ 散在（関連性なし）

新機能（Shared Article Quote）:
┌─────────────────────────────────────────────┐
│ 📰 記者アカウント（共通）                      │
│ 「ジャンプ＋の新連載がスタート」              │
│ https://shonenjumpplus.com/episode/xxx      │
│ [OGP画像・タイトル・説明]                    │
└─────────────────────────────────────────────┘
      │
      ├─→ [リプライ] ユーザーA: 面白かった！
      │
      ├─→ [リプライ] ユーザーB: 絵がきれい
      │
      └─→ [リプライ] ユーザーC: 来週も楽しみ
            ↑ スレッドとして集約
```

## 用語定義

| 用語 | 説明 |
|------|------|
| 記者アカウント | MY PACEが管理する共通のシステムアカウント。記事引用専用 |
| 引用投稿 | 記者アカウントが作成する、記事URL+メタデータを含むkind:1投稿 |

## ユーザー操作

4つの導線がある。

### 1. PostFormのモード切替（常設UI）

投稿フォームの上部に `Post` / `NPC` タブを常設。

```
┌────────────────────────────────────────────┐
│ [Post ●] [NPC]                             │ ← モード切替タブ
│                                            │
│ [avatar] 投稿内容を入力...                   │
│                                            │
└────────────────────────────────────────────┘
```

- **Post** タブ: 通常の投稿モード
- **NPC** タブ: クリックでNPC選択モーダルを開く

**編集・リプライ時はNPCタブが無効化される**（排他）:

```
┌────────────────────────────────────────────┐
│ [Post ●] [NPC]  ← NPCはグレーアウト         │
│ Reply → @username                          │
│                                            │
│ [avatar] リプライ内容...                     │
└────────────────────────────────────────────┘
```

NPCタブをクリックするとNPC選択画面が開く：

```
┌─────────────────────────────────────────────────┐
│ NPCに依頼                              [×] 閉じる │
├─────────────────────────────────────────────────┤
│                                                 │
│ [📰 記者] 記事を引用投稿させる                   │
│                                                 │
│ [🔄 スプレッダー] (準備中)                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

記者を選ぶとURL入力画面：

```
┌─────────────────────────────────────────────────┐
│ 📰 記者に依頼                          [← 戻る]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ 引用させたいURLを入力:                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ https://                                    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│                              [引用させる]        │
└─────────────────────────────────────────────────┘
```

→ 実行後、作成された引用投稿の詳細ページにリダイレクト

### 2. 外部からのIntent URL

外部サイト（ジャンプ＋など）からのリンク経由で引用投稿を作成。

```
https://mypace.llll-ll.com/intent/npc/reporter?url=記事URL
```

→ アクセスすると引用投稿が作られ、投稿詳細ページにリダイレクト

```html
<!-- 外部サイトのシェアボタン例 -->
<a href="https://mypace.llll-ll.com/intent/npc/reporter?url=https://shonenjumpplus.com/episode/xxx">
  MY PACEで感想を見る
</a>
```

### 3. OGPカードにボタン追加

タイムライン上や投稿詳細のOGPカードに「📰 引用させる」ボタンを追加。

```
┌─────────────────────────────────────────┐
│ [OGP画像]                               │
│ 記事タイトル                            │
│ shonenjumpplus.com                      │
│                          [📰 引用させる] │
└─────────────────────────────────────────┘
```

→ クリックで直接APIを呼び、引用投稿の詳細ページにリダイレクト

### 4. Android共有からの選択画面

AndroidでURLを共有（Share Intent）すると、MY PACEが表示される。選択後に「自分で投稿 / 記者に依頼」の選択画面を表示。

```
Android共有メニュー → MY PACE
    ↓
POST /share (Service Worker)
    ↓
選択画面にリダイレクト → /?share_choice=pending&url=...
```

選択画面:

```
┌─────────────────────────────────────────────────┐
│ シェア先を選択                                   │
├─────────────────────────────────────────────────┤
│                                                 │
│ [✏️ 自分で投稿]                                  │
│ URLを本文に埋め込んで編集                        │
│                                                 │
│ [📰 記者に依頼]                                  │
│ 記者に引用投稿を作らせる                         │
│                                                 │
└─────────────────────────────────────────────────┘
```

- 自分で投稿 → 従来通り `/intent/post?text=...`
- 記者に依頼 → `/intent/npc/reporter?url=...`

**注意**: `manifest.json`の`share_target`は1つしか定義できないため、Androidの共有メニューに2つのエントリを表示することはできない。そのため共有後に選択画面を表示する。

---

**決まっていること:**
- 引用投稿を作成するのはAPIの仕事
- リプライはユーザーが既存機能で手動で行う

## API仕様

### GET /api/npc/reporter

URLに対応する引用投稿をリレーから検索。

#### リクエスト

```
GET /api/npc/reporter?url=https://example.com/article
```

#### レスポンス

```typescript
// 見つかった場合
{
  "found": true,
  "event": {
    "id": "abc123...",
    "pubkey": "記者アカウントのpubkey",
    "created_at": 1234567890,
    "kind": 1,
    "content": "...",
    "tags": [...]
  },
  "metadata": {
    "title": "記事タイトル",
    "description": "記事の説明",
    "image": "https://example.com/ogp.jpg"
  }
}

// 見つからない場合
{
  "found": false
}
```

### POST /api/npc/reporter

新しい引用投稿を作成。既存の引用がある場合はそれを返す。

#### リクエスト

```typescript
POST /api/npc/reporter
Content-Type: application/json

{
  "url": "https://example.com/article"
}
```

#### レスポンス

```typescript
// 新規作成成功
{
  "created": true,
  "event": {
    "id": "abc123...",
    // ... 作成された引用投稿のイベント
  },
  "metadata": {
    "title": "記事タイトル",
    "description": "記事の説明",
    "image": "https://example.com/ogp.jpg"
  }
}

// 既存の引用が見つかった場合
{
  "found": true,
  "message": "Quote already exists for this article",
  "event": {
    "id": "abc123...",
    // ... 既存の引用投稿のイベント
  },
  "metadata": {
    "title": "記事タイトル",
    "description": "記事の説明",
    "image": "https://example.com/ogp.jpg"
  }
}
```

#### エラー

```typescript
// OGP取得失敗
{ "error": "ogp_fetch_failed", "message": "Failed to fetch OGP data or no title found" }

// 不正なURL
{ "error": "invalid_url", "message": "URL is required and must be valid" }

// リレー公開失敗
{ "error": "publish_failed", "message": "Failed to publish to relays" }

// 記者未設定
{ "error": "reporter_not_configured", "message": "Reporter account is not configured" }
```

## データ構造

### 引用投稿（kind:1）

```typescript
{
  kind: 1,
  pubkey: "記者アカウントのpubkey",
  created_at: timestamp,
  tags: [
    ['t', 'mypace'],
    ['t', 'mypace-quote'],        // 引用投稿識別タグ
    ['client', 'mypace'],
    ['r', 'https://example.com/article'],  // 正規化済みURL（NIP-25準拠）
    // OGPメタデータ
    ['ogp:title', '記事タイトル'],
    ['ogp:description', '記事の説明...'],
    ['ogp:image', 'https://example.com/ogp.jpg']
  ],
  content: "📰 記事タイトル\n\nShare your thoughts in the replies!\n\nhttps://example.com/article",
  id: "...",
  sig: "..."
}
```

### タグの役割

| タグ | 役割 |
|------|------|
| `t:mypace` | MY PACEフィルタ用 |
| `t:mypace-quote` | 引用投稿の識別 |
| `r` | 正規化済みURL（NIP-25準拠、他クライアント互換、検索用） |
| `ogp:*` | OGPメタデータ（タイムライン表示用） |

### URL正規化

同じ記事への重複引用を防ぐため、URLを正規化：

```typescript
function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  // 1. プロトコル統一（https）
  parsed.protocol = 'https:'
  // 2. トレイリングスラッシュ除去
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  // 3. 不要なクエリパラメータ除去（utm_*, ref, etc.）
  const keepParams = ['id', 'episode', 'chapter', 'p', 'page', 'v']
  for (const key of [...parsed.searchParams.keys()]) {
    if (!keepParams.some(k => key === k || key.startsWith(k + '_'))) {
      parsed.searchParams.delete(key)
    }
  }
  // 4. ハッシュ除去
  parsed.hash = ''
  return parsed.toString()
}
```

正規化済みURLは `r` タグに保存され、リレーへの問い合わせ時に使用される。

## 重複検出

D1キャッシュは使用せず、**リレーに直接問い合わせ**て既存の引用投稿を検索する。

```typescript
// リレーへのクエリ
const filter = {
  authors: [reporterPubkey],
  kinds: [1],
  '#r': [normalizedUrl],   // 正規化URLで検索
  '#t': ['mypace-quote'],  // 引用投稿タグで絞り込み
  limit: 1
}
```

**メリット**:
- D1ストレージ不要（肥大化の心配なし）
- リレーが唯一の情報源（一貫性）

**デメリット**:
- リレー応答に依存（タイムアウトの可能性）

## 記者アカウント

### 概要

- 全ユーザー共通のシステムアカウント
- MY PACE運営が管理
- 記事引用投稿のみを行う（感想は書かない）
- プロフィール名: `📰 MY PACE Reporter` など

### アーキテクチャ

```
┌─────────────┐     POST /api/npc/reporter      ┌──────────────────────────────────┐
│ フロント    │ ───────────────────────→ │ Cloudflare Workers (API)         │
│ エンド      │     { url: "..." }       │                                  │
└─────────────┘                          │ 1. リレーで既存引用を検索        │
                                         │ 2. なければOGP取得               │
                                         │ 3. REPORTER_SECRET_KEY で署名    │
                                         │ 4. Nostrリレーに公開             │
                                         └──────────────────────────────────┘
```

フロントエンドはURLを送るだけ。署名はすべてサーバー側で行う。

### 環境変数設定

```bash
# Cloudflare Workers secrets として設定（wrangler.tomlには書かない）
wrangler secret put REPORTER_SECRET_KEY
# → hex形式の秘密鍵を入力（64文字）
```

公開鍵は秘密鍵から導出できるため、環境変数は秘密鍵のみで十分。

### types.ts への追加

```typescript
// apps/api/src/types.ts
export type Bindings = {
  DB: D1Database
  AI: Ai
  // ... 既存の環境変数 ...

  // NPC Reporter account for Shared Article Quote
  REPORTER_SECRET_KEY?: string  // hex形式（64文字）
}
```

## セキュリティ考慮

### URL検証

```typescript
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
```

### 記者アカウント保護

- 秘密鍵はCloudflare Workers環境変数で管理
- コードにハードコードしない

## 将来の拡張

### 1. カテゴリ・タグ

```typescript
tags: [
  // ... 既存タグ
  ['t', 'manga'],      // カテゴリタグ
  ['t', 'jumpplus'],   // サイトタグ
]
```

### 2. 記事フィード

`mypace-quote` タグでフィルタして、引用投稿だけのタイムラインを表示。

### 3. 記者アカウントの複数化

ジャンル別の記者アカウント:
- `📰 MY PACE 漫画`
- `📰 MY PACE 動画`
- `📰 MY PACE ニュース`

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `apps/api/src/routes/npc/reporter.ts` | 記者API実装 |
| `apps/api/src/routes/npc/index.ts` | NPCルートエクスポート |
| `apps/api/src/utils.ts` | URL正規化・バリデーション |
| `apps/web/src/components/npc/NPCModal.tsx` | NPC選択・URL入力モーダル |
| `apps/web/src/components/npc/ShareChoiceModal.tsx` | Android共有選択画面 |
| `apps/web/src/components/form/PostForm.tsx` | Post/NPCモード切替タブ |
| `apps/web/src/pages/ReporterIntentPage.tsx` | Intent URL処理ページ |
| `apps/web/src/lib/api/api.ts` | フロントエンドAPIクライアント |
| `apps/web/src/sw.ts` | Service Worker（共有URL検出） |

## 関連

- [Intent Share](./intent-share.md) - 従来のテキスト共有機能
- [Repost](./repost.md) - リポスト機能（NIP-18）
- [Dynamic OGP](./dynamic-ogp.md) - OGP取得の参考実装

---

[← 拡張一覧に戻る](./index.md)
