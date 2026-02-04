# Shared Article Quote（共有記事引用）

外部記事URLを共通の「記者アカウント」で引用投稿し、複数ユーザーの感想をスレッドとして集約する機能。

## 概要

従来のIntent Share（`/intent/post`）では、各ユーザーが個別に記事URLを自分の投稿に埋め込んでいた。これでは同じ記事への感想が散在し、議論が生まれにくい。

Shared Article Quoteでは：
- **記者アカウント**が記事を代表して引用投稿
- ユーザーはその引用投稿への**リプライ**として感想を投稿
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
| 感想リプライ | ユーザーが引用投稿に対して投稿するリプライ |
| URLハッシュ | 引用投稿のユニーク性を保証するためのURL正規化ハッシュ |

## Intent URL

### 引用Intent

```
https://mypace.llll-ll.com/intent/quote?url=記事URL
```

#### パラメータ

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `url` | ○ | 引用する記事のURL（URLエンコード必須） |
| `comment` | - | 感想の初期テキスト（任意） |

### 使用例

```html
<!-- 外部サイトのシェアボタン -->
<a href="https://mypace.llll-ll.com/intent/quote?url=https://shonenjumpplus.com/episode/xxx">
  MY PACEで感想を書く
</a>
```

```javascript
// JavaScript（動的）
function shareToMypaceQuote(comment = '') {
  const params = new URLSearchParams({
    url: location.href,
    ...(comment && { comment })
  })
  window.open(`https://mypace.llll-ll.com/intent/quote?${params}`, '_blank')
}
```

## 動作フロー

### 1. 新規引用（記事が未登録の場合）

```
ユーザー: /intent/quote?url=https://example.com/article にアクセス
    │
    ▼
フロントエンド: GET /api/quote?url=... で既存の引用投稿を検索
    │
    ▼ 見つからない
    │
フロントエンド: POST /api/quote { url } で引用投稿の作成をリクエスト
    │
    ▼
API:
  1. URLからOGP情報を取得（タイトル、説明、画像）
  2. 記者アカウントで引用投稿を作成・署名
  3. Nostrリレーに公開
  4. 引用投稿のイベントIDを返却
    │
    ▼
フロントエンド: リプライフォームを表示（引用投稿への返信として）
    │
    ▼
ユーザー: 感想を入力して投稿
```

### 2. 既存引用への追加（記事が登録済みの場合）

```
ユーザー: /intent/quote?url=https://example.com/article にアクセス
    │
    ▼
フロントエンド: GET /api/quote?url=... で既存の引用投稿を検索
    │
    ▼ 見つかった
    │
フロントエンド: 既存の引用投稿を取得
    │
    ▼
フロントエンド: リプライフォームを表示（既存の引用投稿への返信として）
```

## API仕様

### GET /api/quote

URLに対応する引用投稿を検索。

#### リクエスト

```
GET /api/quote?url=https://example.com/article
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
    "image": "https://example.com/ogp.jpg",
    "replyCount": 15  // 感想リプライ数
  }
}

// 見つからない場合
{
  "found": false
}
```

### POST /api/quote

新しい引用投稿を作成。

#### リクエスト

```typescript
POST /api/quote
Content-Type: application/json

{
  "url": "https://example.com/article"
}
```

#### レスポンス

```typescript
{
  "success": true,
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
```

#### エラー

```typescript
// OGP取得失敗
{ "error": "ogp_fetch_failed", "message": "Failed to fetch OGP data" }

// 不正なURL
{ "error": "invalid_url", "message": "URL is not valid" }

// 既に存在（競合）
{ "error": "already_exists", "eventId": "abc123..." }
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
    ['r', 'https://example.com/article'],  // 記事URL（NIP-25準拠）
    ['url-hash', 'sha256-hash'],  // URL正規化ハッシュ（検索用）
    // OGPメタデータ
    ['ogp:title', '記事タイトル'],
    ['ogp:description', '記事の説明...'],
    ['ogp:image', 'https://example.com/ogp.jpg']
  ],
  content: "📰 記事タイトル\n\nhttps://example.com/article",
  id: "...",
  sig: "..."
}
```

### タグの役割

| タグ | 役割 |
|------|------|
| `t:mypace` | MY PACEフィルタ用 |
| `t:mypace-quote` | 引用投稿の識別 |
| `r` | 記事URL（NIP-25準拠、他クライアント互換） |
| `url-hash` | URL正規化ハッシュ（重複防止・検索用） |
| `ogp:*` | OGPメタデータ（タイムライン表示用） |

### URL正規化

同じ記事への重複引用を防ぐため、URLを正規化してハッシュ化：

```typescript
function normalizeUrl(url: string): string {
  const parsed = new URL(url)
  // 1. プロトコル統一（https）
  parsed.protocol = 'https:'
  // 2. トレイリングスラッシュ除去
  parsed.pathname = parsed.pathname.replace(/\/+$/, '')
  // 3. 不要なクエリパラメータ除去（utm_*, ref, etc.）
  const keepParams = ['id', 'episode', 'chapter', 'p', 'page']
  for (const key of [...parsed.searchParams.keys()]) {
    if (!keepParams.includes(key) && !key.startsWith('v')) {
      parsed.searchParams.delete(key)
    }
  }
  // 4. ハッシュ除去
  parsed.hash = ''
  return parsed.toString()
}

function hashUrl(url: string): string {
  const normalized = normalizeUrl(url)
  return sha256(normalized)
}
```

## 記者アカウント

### 概要

- 全ユーザー共通のシステムアカウント
- MY PACE運営が管理
- 記事引用投稿のみを行う（感想は書かない）
- プロフィール名: `📰 MY PACE Reporter` など

### アーキテクチャ

```
┌─────────────┐     POST /api/quote      ┌──────────────────────────────────┐
│ フロント    │ ───────────────────────→ │ Cloudflare Workers (API)         │
│ エンド      │     { url: "..." }       │                                  │
└─────────────┘                          │ 1. OGP取得                       │
                                         │ 2. REPORTER_SECRET_KEY で署名    │
                                         │ 3. Nostrリレーに公開             │
                                         └──────────────────────────────────┘
```

フロントエンドはURLを送るだけ。署名はすべてサーバー側で行う。

### 鍵の生成

```bash
# 1. 新しいNostr鍵ペアを生成（nostr-toolsを使用）
npx tsx apps/api/scripts/generate-reporter-keys.ts

# 出力例:
# Secret Key (hex): 0123456789abcdef...
# Public Key (hex): fedcba9876543210...
# nsec: nsec1...
# npub: npub1...
```

生成スクリプト例:

```typescript
// apps/api/scripts/generate-reporter-keys.ts
import { generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import { nsecEncode, npubEncode } from 'nostr-tools/nip19'
import { bytesToHex } from '@noble/hashes/utils'

const sk = generateSecretKey()
const pk = getPublicKey(sk)

console.log('Secret Key (hex):', bytesToHex(sk))
console.log('Public Key (hex):', pk)
console.log('nsec:', nsecEncode(sk))
console.log('npub:', npubEncode(pk))
console.log('')
console.log('Set as Cloudflare Workers secrets:')
console.log('  wrangler secret put REPORTER_SECRET_KEY')
console.log('  (paste the hex secret key)')
```

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

  // Reporter account for Shared Article Quote
  REPORTER_SECRET_KEY?: string  // hex形式（64文字）
}
```

### 鍵管理の図

```
┌─────────────────────────────────────────┐
│ Cloudflare Workers                      │
│                                         │
│ 環境変数（wrangler secret）:            │
│   REPORTER_SECRET_KEY = "0123..."      │ ← hex形式（64文字）
│                                         │
│ 公開鍵は getPublicKey(sk) で導出        │
│ ※ シークレットはWrangler secretsで管理  │
└─────────────────────────────────────────┘
```

### 署名フロー

```typescript
// apps/api/src/routes/quote.ts
import { Hono } from 'hono'
import { finalizeEvent, getPublicKey } from 'nostr-tools/pure'
import { hexToBytes } from '@noble/hashes/utils'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.post('/quote', async (c) => {
  const { url } = await c.req.json<{ url: string }>()

  // 1. 環境変数から秘密鍵を取得し、公開鍵を導出
  const sk = c.env.REPORTER_SECRET_KEY
  if (!sk) {
    return c.json({ error: 'reporter_not_configured' }, 500)
  }
  const pk = getPublicKey(hexToBytes(sk))

  // 2. 既存の引用投稿を確認（D1キャッシュ）
  const existing = await findExistingQuote(c.env.DB, url)
  if (existing) {
    return c.json({ found: true, event: existing })
  }

  // 3. OGP情報を取得
  const ogp = await fetchOGP(url)

  // 4. 記者アカウントで署名
  const event = {
    kind: 1,
    pubkey: pk,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['t', 'mypace'],
      ['t', 'mypace-quote'],
      ['client', 'mypace'],
      ['r', url],
      ['url-hash', hashUrl(url)],
      ['ogp:title', ogp.title],
      ['ogp:description', ogp.description || ''],
      ['ogp:image', ogp.image || '']
    ],
    content: `📰 ${ogp.title}\n\n${url}`
  }

  const signedEvent = finalizeEvent(event, hexToBytes(sk))

  // 5. Nostrリレーに公開
  await publishToRelays(signedEvent)

  // 6. D1にキャッシュ保存
  await saveQuoteToCache(c.env.DB, url, signedEvent, ogp)

  return c.json({ success: true, event: signedEvent })
})
```

**ポイント:**
- 秘密鍵はサーバー側の環境変数にのみ存在
- フロントエンドはURLを送るだけで、署名には関与しない
- VAPID鍵と同様に `wrangler secret` で安全に管理

## フロントエンド実装

### ルーティング

```typescript
// App.tsx
<Route path="/intent/quote" element={<QuoteIntentPage />} />
```

### QuoteIntentPage

```typescript
// pages/QuoteIntentPage.tsx
export function QuoteIntentPage() {
  const [searchParams] = useSearchParams()
  const url = searchParams.get('url')
  const initialComment = searchParams.get('comment') || ''

  const [quoteEvent, setQuoteEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url) {
      setError('URLが指定されていません')
      setLoading(false)
      return
    }

    fetchOrCreateQuote(url)
      .then(setQuoteEvent)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [url])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorMessage message={error} />

  // 引用投稿が取得できたら、リプライフォームを表示
  return (
    <QuoteReplyView
      quoteEvent={quoteEvent}
      initialContent={initialComment}
    />
  )
}
```

### QuoteReplyView

```typescript
// components/quote/QuoteReplyView.tsx
export function QuoteReplyView({ quoteEvent, initialContent }: Props) {
  return (
    <div className="quote-reply-view">
      {/* 引用投稿のプレビュー */}
      <QuotePreviewCard event={quoteEvent} />

      {/* 既存の感想リプライ一覧 */}
      <QuoteReplies quoteEventId={quoteEvent.id} />

      {/* リプライフォーム */}
      <PostForm
        replyTo={quoteEvent}
        initialContent={initialContent}
        placeholder="この記事への感想を書く..."
      />
    </div>
  )
}
```

### QuotePreviewCard

```typescript
// components/quote/QuotePreviewCard.tsx
export function QuotePreviewCard({ event }: { event: Event }) {
  const ogp = extractOGPFromTags(event.tags)
  const url = event.tags.find(t => t[0] === 'r')?.[1]

  return (
    <div className="quote-preview-card">
      <div className="quote-reporter">
        <ReporterAvatar />
        <span>📰 MY PACE Reporter</span>
      </div>

      <a href={url} target="_blank" rel="noopener noreferrer">
        {ogp.image && <img src={ogp.image} alt="" className="ogp-image" />}
        <div className="ogp-content">
          <h3>{ogp.title}</h3>
          {ogp.description && <p>{ogp.description}</p>}
          <span className="ogp-url">{new URL(url).hostname}</span>
        </div>
      </a>
    </div>
  )
}
```

## D1データベース（キャッシュ）

APIレスポンス高速化のため、D1に引用投稿をキャッシュ。

### スキーマ

```sql
CREATE TABLE article_quotes (
  url_hash TEXT PRIMARY KEY,      -- URL正規化ハッシュ
  url TEXT NOT NULL,              -- 元URL
  event_id TEXT NOT NULL,         -- NostrイベントID
  event_json TEXT NOT NULL,       -- イベントJSON（キャッシュ）
  ogp_title TEXT,
  ogp_description TEXT,
  ogp_image TEXT,
  reply_count INTEGER DEFAULT 0,  -- 感想リプライ数（定期更新）
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_quotes_event_id ON article_quotes(event_id);
```

### キャッシュ戦略

1. **GET時**: D1を先に検索 → ヒットしたらそのまま返却 → ミスならリレー検索
2. **POST時**: リレーに公開 → D1にキャッシュ保存
3. **リプライ数**: Cronジョブで定期更新（1時間ごと）

### キャッシュミス時のリレー検索

D1にキャッシュがない場合、Nostrリレーから引用投稿を検索する：

```typescript
async function findQuoteFromRelay(url: string, reporterPubkey: string): Promise<Event | null> {
  const urlHash = hashUrl(url)

  // 方法1: url-hashタグで検索（推奨）
  const filter = {
    kinds: [1],
    authors: [reporterPubkey],
    '#url-hash': [urlHash],
    limit: 1
  }

  // 方法2: authorsのみで検索し、クライアント側でフィルタ
  // （リレーが#url-hashをサポートしない場合のフォールバック）
  const fallbackFilter = {
    kinds: [1],
    authors: [reporterPubkey],
    '#t': ['mypace-quote'],
    limit: 100
  }

  const events = await fetchFromRelays(filter)
  return events[0] || null
}
```

**注意**: リレー検索でヒットした場合は、D1にキャッシュを書き戻す。

### 競合制御（Race Condition）

同時に複数ユーザーが同じURLを引用しようとした場合の対策：

```sql
-- INSERT OR IGNORE で重複を防止
INSERT OR IGNORE INTO article_quotes (url_hash, url, event_id, ...)
VALUES (?, ?, ?, ...);
```

```typescript
app.post('/quote', async (c) => {
  const { url } = await c.req.json<{ url: string }>()
  const urlHash = hashUrl(url)

  // 1. まずD1に存在確認
  const existing = await findExistingQuote(c.env.DB, urlHash)
  if (existing) {
    return c.json({ found: true, event: existing })
  }

  // 2. リレーにも確認（他インスタンスが作成済みの可能性）
  const fromRelay = await findQuoteFromRelay(url, reporterPubkey)
  if (fromRelay) {
    // D1にキャッシュして返却
    await saveQuoteToCache(c.env.DB, url, fromRelay, extractOGP(fromRelay))
    return c.json({ found: true, event: fromRelay })
  }

  // 3. 新規作成
  const signedEvent = await createAndPublishQuote(url, c.env)

  // 4. D1に保存（INSERT OR IGNORE で競合を無視）
  try {
    await saveQuoteToCache(c.env.DB, url, signedEvent, ogp)
  } catch (e) {
    // 競合が発生した場合、既存のものを返す
    const raceWinner = await findExistingQuote(c.env.DB, urlHash)
    if (raceWinner) {
      return c.json({ found: true, event: raceWinner })
    }
  }

  return c.json({ success: true, event: signedEvent })
})
```

**ポイント:**
- D1の`INSERT OR IGNORE`で重複挿入を防止
- リレーへの公開は冪等ではないが、同じURLに対して複数の引用投稿が作られても、D1キャッシュが正となる
- 最悪ケースでも「少し余分な引用投稿がリレーに残る」だけで、ユーザー体験には影響しない

## UI/UX設計

### 引用Intentページ

```
┌─────────────────────────────────────────────────┐
│ MY PACE                              [×] 閉じる │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📰 MY PACE Reporter                         │ │
│ │                                             │ │
│ │ ┌─────────────────────────────────────────┐ │ │
│ │ │ [OGP画像]                               │ │ │
│ │ │ 記事タイトル                            │ │ │
│ │ │ 記事の説明文...                         │ │ │
│ │ │ shonenjumpplus.com                      │ │ │
│ │ └─────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 💬 みんなの感想 (15件)                          │
│ ┌─────────────────────────────────────────────┐ │
│ │ [アバター] ユーザーA · 3時間前              │ │
│ │ 面白かった！主人公の成長が良い              │ │
│ └─────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────┐ │
│ │ [アバター] ユーザーB · 2時間前              │ │
│ │ 絵がきれいで読みやすい                      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ この記事への感想を書く...                   │ │
│ │                                             │ │
│ │                                             │ │
│ │                              [投稿] ボタン  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### タイムラインでの表示

引用投稿への感想リプライは、タイムラインで以下のように表示：

```
┌─────────────────────────────────────────────────┐
│ [ユーザーアバター] ユーザー名 · 時刻            │
│                                                 │
│ 面白かった！主人公の成長が良い                  │
│                                                 │
│ 📰 返信先: 記事タイトル                         │ ← クリックで引用投稿へ
│ ┌─────────────────────────────────────────────┐ │
│ │ [OGP画像小] 記事タイトル                    │ │
│ │ shonenjumpplus.com                          │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## セキュリティ考慮

### URL検証

```typescript
const ALLOWED_URL_PATTERNS = [
  /^https:\/\/(www\.)?shonenjumpplus\.com\//,
  /^https:\/\/(www\.)?comic-zenon\.com\//,
  /^https:\/\/(www\.)?youtube\.com\//,
  /^https:\/\/youtu\.be\//,
  // ... 許可リスト方式 or
  // 全URL許可（スパム対策は別途）
]

function isAllowedUrl(url: string): boolean {
  // オプション1: 許可リスト方式
  // return ALLOWED_URL_PATTERNS.some(p => p.test(url))

  // オプション2: 全URL許可（レート制限で対策）
  return isValidHttpUrl(url)
}
```

### レート制限

```typescript
// 同一IPからの引用作成を制限
const RATE_LIMIT = {
  window: 60 * 60 * 1000,  // 1時間
  maxRequests: 10          // 10件まで
}
```

### 記者アカウント保護

- 秘密鍵はCloudflare Workers環境変数で管理
- コードにハードコードしない
- 鍵のローテーション手順を文書化

## 将来の拡張

### 1. カテゴリ・タグ

```typescript
tags: [
  // ... 既存タグ
  ['t', 'manga'],      // カテゴリタグ
  ['t', 'jumpplus'],   // サイトタグ
]
```

### 2. 人気記事ランキング

```sql
-- リプライ数でソート
SELECT * FROM article_quotes
ORDER BY reply_count DESC
LIMIT 20
```

### 3. 記事フィード

`mypace-quote` タグでフィルタして、引用投稿だけのタイムラインを表示。

### 4. 記者アカウントの複数化

ジャンル別の記者アカウント:
- `📰 MY PACE 漫画`
- `📰 MY PACE 動画`
- `📰 MY PACE ニュース`

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `apps/api/src/routes/quote.ts` | 引用API実装 |
| `apps/web/src/pages/QuoteIntentPage.tsx` | Intent処理ページ |
| `apps/web/src/components/quote/QuotePreviewCard.tsx` | 引用プレビューカード |
| `apps/web/src/components/quote/QuoteReplies.tsx` | 感想リプライ一覧 |
| `apps/web/src/lib/api/quote.ts` | APIクライアント |

## 関連

- [Intent Share](./intent-share.md) - 従来のテキスト共有機能
- [Repost](./repost.md) - リポスト機能（NIP-18）
- [Dynamic OGP](./dynamic-ogp.md) - OGP取得の参考実装

---

[← 拡張一覧に戻る](./index.md)
