# 画像シェア機能（Share as Image）

## 概要

投稿カードやワードロット合成結果のポップアップを画像化してSNSにシェアする機能。

## 背景・目的

- **視認性**: テキストのURLだけでは伝わらない、視覚的な魅力をシェア
- **サービス宣伝**: 画像と共にMY PACEのURLを含めることで、サービスへの導線を確保
- **ユーザー満足度**: 達成感を共有しやすくし、ゲーミフィケーション要素を強化

## 対象コンテンツ

### 1. 投稿カード（Post Card）

投稿カード全体を画像化してシェア。

**シェア対象要素**:

- 投稿者情報（アバター、名前、タイムスタンプ）
- 投稿本文（絵文字、リンク含む）
- ステッカー、バーコード
- リアクション数（ステラ、リプライ、リポスト）
- MY PACEのロゴ・URL（画像下部に追加）

**UI配置**:

- 投稿カードのシェアメニュー内に「画像として共有」オプションを追加
- 既存のシェアオプション（URL、Markdown等）と並列

### 2. ワードロット合成ポップアップ（Wordrot Synthesis Popup）

ワードロット合成成功時のポップアップを画像化してシェア。

**シェア対象要素**:

- タイトル（"New Wordrot!" / "New Recipe!" / "Synthesis Complete!"）
- 合成結果のワードカード（大）
- バッジ（NEW! / New Recipe!）
- 合成レシピ（A - B + C = Result）
- MY PACEのロゴ・URL（画像下部に追加）

**UI配置**:

- ポップアップ下部に幅広のシェアボタンを追加
- ボタンテキスト: 「この発見をシェア」「Share your discovery!」等、共有したくなる表現

## 技術仕様

### 画像化手法

**サーバーサイドでの画像生成**:

クライアント側で`html2canvas`を使うのではなく、サーバーサイドで画像を生成し、静的URLを返す。

#### APIエンドポイント

**POST `/api/share-image`**

リクエスト:

```json
{
  "type": "post" | "wordrot",
  "eventId": "...",           // type=post の場合
  "word": "...",              // type=wordrot の場合
  "recipe": {                 // type=wordrot の場合
    "a": "word1",
    "b": "word2",
    "c": "word3"
  },
  "isNewWord": true,          // type=wordrot の場合
  "isNewRecipe": false        // type=wordrot の場合
}
```

レスポンス:

```json
{
  "imageUrl": "https://mypace.jp/share-images/abc123def456.png",
  "expiresAt": 1234567890
}
```

#### 画像生成プロセス

1. **データ取得**
   - 投稿カード: イベントデータをリレーから取得
   - ワードロット: ワード情報をDBから取得

2. **画像レンダリング**
   - Puppeteer or Playwrightでヘッドレスブラウザを起動
   - HTMLテンプレートをレンダリング
   - スクリーンショットを撮影

3. **画像保存**
   - Cloudflare R2に保存（パブリックアクセス可能）
   - ファイル名: `{hash}.png`（イベントID/ワードからハッシュ生成）
   - TTL: 7日間（期限切れ後は自動削除）

4. **URL返却**
   - `https://mypace.jp/share-images/{hash}.png`

### シェアフロー

1. **画像生成ボタンをクリック**
   - ローディング表示
   - API `/api/share-image` を呼び出し

2. **画像URL取得**
   - サーバーから静的URLを受信
   - シェアメニューを表示

3. **シェアメニュー**
   - メニュー項目（上から順に）:
     1. 🖼️ **画像を開く** - 新しいタブで画像URLを開く
     2. 💾 **画像を保存** - 画像をダウンロード
     3. 📋 **画像URLをコピー** - 画像URLをクリップボードにコピー
     4. 🐦 **Xでシェア** - X投稿画面を開く（画像URL + テキスト）
     5. 🦋 **Blueskyでシェア** - Bluesky投稿画面を開く
     6. 🧵 **Threadsでシェア** - Threads投稿画面を開く

### 画像生成API実装例

```typescript
// apps/api/src/routes/share-image.ts
import { Hono } from 'hono'
import { chromium } from 'playwright'
import { R2Bucket } from '@cloudflare/workers-types'

const app = new Hono()

app.post('/share-image', async (c) => {
  const { type, eventId, word, recipe, isNewWord, isNewRecipe } = await c.req.json()

  // Generate hash for caching
  const hash = type === 'post' ? `post-${eventId}` : `wordrot-${word}-${recipe.a}-${recipe.b}-${recipe.c}`
  const imageKey = `${hash}.png`

  // Check if image already exists
  const r2 = c.env.SHARE_IMAGES_BUCKET as R2Bucket
  const existing = await r2.head(imageKey)
  if (existing) {
    return c.json({
      imageUrl: `https://mypace.jp/share-images/${imageKey}`,
      expiresAt: existing.customMetadata?.expiresAt,
    })
  }

  // Generate image
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } })

  // Render HTML template
  const html =
    type === 'post'
      ? await generatePostCardHTML(eventId)
      : await generateWordrotHTML(word, recipe, isNewWord, isNewRecipe)

  await page.setContent(html)
  const screenshot = await page.screenshot({ type: 'png' })
  await browser.close()

  // Upload to R2
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 days
  await r2.put(imageKey, screenshot, {
    httpMetadata: { contentType: 'image/png' },
    customMetadata: { expiresAt: expiresAt.toString() },
  })

  return c.json({
    imageUrl: `https://mypace.jp/share-images/${imageKey}`,
    expiresAt,
  })
})
```

````

### シェアフロー

1. **キャプチャ準備**
   - 対象要素に一時的なクラス追加（スタイル調整用）
   - MY PACEロゴ・URL要素を追加
2. **画像生成**
   - `html2canvas`で要素をキャプチャ
   - PNG形式で出力
3. **ロゴ・URL削除**
   - キャプチャ後、一時要素を削除
4. **シェア**
   - Web Share API（モバイル）またはダウンロード（デスクトップ）
   - X、Bluesky、Threads等への直接投稿も検討

### Web Share API対応

```typescript
async function shareImage(blob: Blob, url: string, text: string) {
  const file = new File([blob], 'mypace-share.png', { type: 'image/png' })

  if (navigator.share && navigator.canShare({ files: [file] })) {
    // Web Share API (モバイル)
    await navigator.share({
      files: [file],
      title: text,
      text: `${text}\n${url}`,
    })
  } else {
    // フォールバック: ダウンロード
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'mypace-share.png'
    link.click()
    URL.revokeObjectURL(link.href)
  }
}
````

### SNS別シェア対応

画像URLとテキストをSNS投稿画面に渡す。

#### X (Twitter)

```typescript
function shareToX(imageUrl: string, text: string, pageUrl: string) {
  const tweetText = `${text}\n\n🖼️ ${imageUrl}\n🔗 ${pageUrl}`
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
  window.open(xUrl, '_blank')
}
```

#### Bluesky

```typescript
function shareToBluesky(imageUrl: string, text: string, pageUrl: string) {
  const bskyText = `${text}\n\n🖼️ ${imageUrl}\n🔗 ${pageUrl}`
  const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(bskyText)}`
  window.open(bskyUrl, '_blank')
}
```

#### Threads

```typescript
function shareToThreads(imageUrl: string, text: string, pageUrl: string) {
  const threadsText = `${text}\n\n🖼️ ${imageUrl}\n🔗 ${pageUrl}`
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(threadsText)}`
  window.open(threadsUrl, '_blank')
}
```

### クライアント側実装

```typescript
// シェアボタンクリック時
async function handleShareAsImage() {
  setLoading(true)

  try {
    // 画像生成APIを呼び出し
    const response = await fetch('/api/share-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'wordrot',
        word: 'example',
        recipe: { a: 'word1', b: 'word2', c: 'word3' },
        isNewWord: true,
        isNewRecipe: false,
      }),
    })

    const { imageUrl } = await response.json()

    // シェアメニューを表示
    showShareMenu(imageUrl)
  } finally {
    setLoading(false)
  }
}

// シェアメニュー項目
const shareMenuItems = [
  {
    icon: '🖼️',
    label: '画像を開く',
    action: (imageUrl: string) => window.open(imageUrl, '_blank'),
  },
  {
    icon: '💾',
    label: '画像を保存',
    action: (imageUrl: string) => {
      const link = document.createElement('a')
      link.href = imageUrl
      link.download = 'mypace-share.png'
      link.click()
    },
  },
  {
    icon: '📋',
    label: '画像URLをコピー',
    action: (imageUrl: string) => {
      navigator.clipboard.writeText(imageUrl)
      showToast('URLをコピーしました')
    },
  },
  {
    icon: '🐦',
    label: 'Xでシェア',
    action: (imageUrl: string) => shareToX(imageUrl, text, pageUrl),
  },
  // ... 以下同様
]
```

````

### 画像内のMY PACE情報追加

キャプチャ前に一時的に以下の要素を追加:

```tsx
<div className="share-footer">
  <img src="/logo.svg" alt="MY PACE" className="share-logo" />
  <span className="share-url">mypace.jp</span>
</div>
````

CSS:

```css
.share-footer {
  display: none; /* 通常は非表示 */
  padding: 1rem;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #666;
}

/* キャプチャ時のみ表示 */
.capturing .share-footer {
  display: flex;
}

.share-logo {
  height: 20px;
}
```

## UI設計

### 投稿カードのシェアボタン

既存のシェアメニュー（ShareMenu.tsx）に追加:

```tsx
export type ShareOption =
  | 'url-copy'
  | 'url-nostr'
  | 'url-share'
  | 'md-copy'
  | 'md-download'
  | 'md-open'
  | 'x'
  | 'bluesky'
  | 'threads'
  | 'image-share' // 新規追加
```

メニュー項目:

```
📷 画像として共有
```

### ワードロットポップアップのシェアボタン

ポップアップ下部（"Tap anywhere to continue"の上）に配置:

```tsx
;<button className="word-synthesis-share-button" onClick={handleGenerateShareImage}>
  <Icon name="Share2" size={20} />
  <span>この発見をシェア</span>
  {loading && <Icon name="Loader" size={16} className="spinning" />}
</button>

{
  /* シェアメニュー（画像URL取得後に表示） */
}
{
  shareImageUrl && (
    <div className="share-image-menu">
      <div className="share-image-menu-item" onClick={() => window.open(shareImageUrl, '_blank')}>
        🖼️ 画像を開く
      </div>
      <div className="share-image-menu-item" onClick={() => downloadImage(shareImageUrl)}>
        💾 画像を保存
      </div>
      <div className="share-image-menu-item" onClick={() => copyToClipboard(shareImageUrl)}>
        📋 画像URLをコピー
      </div>
      <div className="share-image-menu-item" onClick={() => shareToX(shareImageUrl, text, pageUrl)}>
        🐦 Xでシェア
      </div>
      <div className="share-image-menu-item" onClick={() => shareToBluesky(shareImageUrl, text, pageUrl)}>
        🦋 Blueskyでシェア
      </div>
      <div className="share-image-menu-item" onClick={() => shareToThreads(shareImageUrl, text, pageUrl)}>
        🧵 Threadsでシェア
      </div>
    </div>
  )
}
```

CSS:

```css
.word-synthesis-share-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 2rem;
  margin: 1rem auto 0.5rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  min-width: 200px;
}

.word-synthesis-share-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.word-synthesis-share-button:active {
  transform: translateY(0);
}

.share-image-menu {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 1rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.share-image-menu-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: white;
  border: 1px solid rgba(0, 0, 0, 0.1);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.95rem;
}

.share-image-menu-item:hover {
  background: #f5f5f5;
  border-color: #667eea;
  transform: translateX(4px);
}
```

.word-synthesis-share-button:hover {
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.word-synthesis-share-button:active {
transform: translateY(0);
}

```

## シェアテキスト案

### 投稿カード

```

MY PACEで投稿しました！
https://mypace.jp/post/{eventId}

```

### ワードロット

#### 新規ワード発見時

```

新しいワードロット「{word}」を発見しました！
レシピ: {A} - {B} + {C}
https://mypace.jp/inventory?tab=wordrot&word={word}

```

#### 新規レシピ発見時

```

「{word}」の新しいレシピを発見しました！
レシピ: {A} - {B} + {C}
https://mypace.jp/inventory?tab=wordrot&word={word}

```

#### 既存ワード合成時

```

ワードロット「{word}」を合成しました！
レシピ: {A} - {B} + {C}
https://mypace.jp/inventory?tab=wordrot&word={word}

```

## 実装優先度

1. **Phase 1**: ワードロットポップアップのシェア機能
   - 理由: ゲーミフィケーション要素として効果が高い
   - ユーザーが共有したくなる瞬間（達成感）を逃さない
2. **Phase 2**: 投稿カードのシェア機能
   - 理由: より広範な用途に対応
   - 既存のシェアメニューへの追加が必要

## 制約・注意事項

- **サーバーコスト**: Puppeteer/Playwrightの実行にはメモリとCPUリソースが必要
  - 対策: キャッシュ機構（同じ内容の画像は再生成しない）、TTL設定

- **生成時間**: 画像生成には数秒かかる場合がある
  - 対策: ローディング表示、非同期処理

- **ストレージ容量**: R2バケットの容量制限
  - 対策: TTL設定（7日後に自動削除）、定期的なクリーンアップ

- **外部画像**: アバター画像等の外部リソースが読み込めない可能性
  - 対策: プロキシ経由で取得、タイムアウト設定

- **プライバシー**: 画像URLは誰でもアクセス可能
  - 対策: 自分の投稿のみシェア可能、公開範囲が限定された投稿は制限

## 関連仕様

- [stella.md](./stella.md) - ステラ表示
- [wordrot.md](./wordrot.md) - ワードロット機能
- [repost.md](./repost.md) - リポスト機能

---

[← 拡張仕様一覧に戻る](./index.md)
```
