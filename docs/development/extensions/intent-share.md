# Intent Share（MY PACEでシェア）

外部サイトからMY PACEの投稿画面にテキストを渡す機能。

## 概要

XやFacebookの「シェア」ボタンと同様に、外部サイトから「MY PACEでシェア」リンクを設置できる。リンクをクリックするとMY PACEが開き、投稿エディタにテキストがセットされた状態になる。

## Intent URL

```
https://mypace.llll-ll.com/intent/post?text=シェアしたいテキスト
```

### パラメータ

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `text` | ○ | 投稿本文にセットするテキスト（URLエンコード必須） |

- URLを含めたい場合は`text`パラメータ内に含める
- 文字数が上限を超える場合は末尾をカット

## 使用方法

外部サイトがシェアボタンを設置する場合、`text`にページタイトルとURLを含める。

### HTML（静的）

```html
<a href="https://mypace.llll-ll.com/intent/post?text=記事タイトル%20https://example.com/article">
  MY PACEでシェア
</a>
```

### JavaScript（動的・推奨）

現在のページをシェアするボタン:

```javascript
function shareToMypace() {
  const text = `${document.title} ${location.href}`
  const url = `https://mypace.llll-ll.com/intent/post?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}
```

```html
<button onclick="shareToMypace()">MY PACEでシェア</button>
```

### カスタムテキスト付き

```javascript
function shareToMypace(customText) {
  const text = customText
    ? `${customText} ${location.href}`
    : `${document.title} ${location.href}`
  const url = `https://mypace.llll-ll.com/intent/post?text=${encodeURIComponent(text)}`
  window.open(url, '_blank')
}

// 使用例
shareToMypace('この記事おすすめ！')
// → "この記事おすすめ！ https://example.com/article" が投稿欄にセットされる
```

## 動作

1. Intent URLにアクセス
2. プロフィール未設定の場合 → ProfileSetupが表示される → 名前設定後に投稿エディタ
3. プロフィール設定済みの場合 → 投稿エディタに`text`の内容がセットされた状態で表示
4. ユーザーは内容を編集して投稿できる

## 実装

### ルート

`/intent/post` を `HomePage` にマッピング:

```typescript
// App.tsx
<Route path="/intent/post" element={<HomePage />} />
```

### クエリパラメータ処理

`HomePage` で `text` パラメータを処理:

```typescript
// HomePage.tsx
const shareText = searchParams.get('text')

if (shareText) {
  const truncated = shareText.length > LIMITS.MAX_POST_LENGTH
    ? shareText.slice(0, LIMITS.MAX_POST_LENGTH)
    : shareText
  setContent(truncated)
}
```

## Web Share Target API（Android連携）

AndroidのファイラーやChromeの共有メニューからMY PACEに直接シェアする機能。PWAとしてインストールされている場合に利用可能。

### 概要

- **テキストのシェア**: Chromeの共有ボタン → MY PACEを選択 → 投稿欄にテキストがセットされた状態で開く
- **画像のシェア**: ファイラーで画像を共有 → MY PACEを選択 → ImageEditorが開く（クロップ等の編集が可能）

### マニフェスト設定

```json
{
  "share_target": {
    "action": "/share",
    "method": "POST",
    "enctype": "multipart/form-data",
    "params": {
      "title": "title",
      "text": "text",
      "url": "url",
      "files": [
        {
          "name": "images",
          "accept": ["image/*"]
        }
      ]
    }
  }
}
```

### 処理フロー

#### テキストのみの場合

```
Android共有メニュー → MY PACE
    ↓
POST /share (Service Worker)
    ↓ text/url/titleを結合
リダイレクト → /intent/post?text=... （既存処理を利用）
    ↓
HomePage: 投稿欄にテキストがセットされた状態で表示
```

#### 画像ファイルの場合

```
Android共有メニュー → MY PACE
    ↓
POST /share (Service Worker)
    ↓ 画像ファイルを抽出
IndexedDBに一時保存（share-target-images）
    ↓
リダイレクト → /?share_image=pending
    ↓
HomePage: share_imageパラメータを検知
    ↓ IndexedDBから画像を取得 → 即座にIndexedDBから削除
    ↓ Fileオブジェクトはメモリ（React state）に保持
ImageEditorが開く（クロップ・ステッカー追加可能）
    ↓
（以降は通常のImagePicker経由と同じ動作）
```

### Service Worker実装

```typescript
// sw.ts
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  if (url.pathname === '/share' && event.request.method === 'POST') {
    event.respondWith(handleShareTarget(event.request))
  }
})

async function handleShareTarget(request: Request): Promise<Response> {
  const formData = await request.formData()
  const files = formData.getAll('images') as File[]
  const text = formData.get('text') as string | null
  const url = formData.get('url') as string | null
  const title = formData.get('title') as string | null

  if (files.length > 0) {
    // 画像がある場合: IndexedDBに保存してリダイレクト
    await saveShareTargetImage(files[0])
    return Response.redirect('/?share_image=pending', 303)
  }

  // テキストのみ: 既存のintent/postにリダイレクト
  // Web Share APIはtitle/text/urlを別々に渡すので結合する
  const shareText = [title, text, url].filter(Boolean).join(' ')
  const redirectUrl = `/intent/post?text=${encodeURIComponent(shareText)}`
  return Response.redirect(redirectUrl, 303)
}
```

### IndexedDB スキーマ

```typescript
// lib/storage/share-target.ts
const DB_NAME = 'mypace-share-target'
const STORE_NAME = 'images'
const STALE_THRESHOLD_MS = 60 * 60 * 1000  // 1時間

interface ShareTargetImage {
  id: 'pending'  // 常に1件のみ保持
  file: File
  timestamp: number
}

// 保存（Service Workerから呼ばれる）
async function saveShareTargetImage(file: File): Promise<void>

// 取得して削除（HomePageから呼ばれる）
// - 取得と同時にIndexedDBから削除
// - 1時間以上前のエントリは古いと判断して無視（クラッシュ対策）
async function consumeShareTargetImage(): Promise<File | null>
```

### HomePage での処理

```typescript
// HomePage.tsx
const [sharedImageFile, setSharedImageFile] = useState<File | null>(null)

useEffect(() => {
  const shareImage = searchParams.get('share_image')

  if (shareImage === 'pending') {
    consumeShareTargetImage().then((file) => {
      if (file) {
        setSharedImageFile(file)
      }
    })
    // URLからパラメータを削除
    navigate('/', { replace: true })
  }
}, [searchParams])

// sharedImageFileをPostFormに渡す
<PostForm
  sharedImageFile={sharedImageFile}
  onSharedImageProcessed={() => setSharedImageFile(null)}
  // ...
/>
```

### PostForm での処理

```typescript
// PostForm.tsx に新しいprops追加
interface PostFormProps {
  // ... 既存props
  sharedImageFile?: File | null
  onSharedImageProcessed?: () => void
}

// sharedImageFileがセットされたらImagePickerの処理を呼び出す
// （ImagePicker内のpendingFile stateにセットしてImageEditorを開く）
```

### 注意事項

- PWAとしてインストールされている場合のみ有効
- 画像は1件のみ対応（複数画像の共有は最初の1件のみ処理）
- IndexedDBの画像は取得時に即削除（Fileオブジェクトはメモリに保持）
- 1時間以上前のエントリは古いと判断して無視（クラッシュ・異常終了対策）

## 関連

- 投稿のシェアメニュー（投稿をURLやMarkdownでシェアする機能）→ [ユーザーガイド: 共有](../../user-guide/features/share.md)
