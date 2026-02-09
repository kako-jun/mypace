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

**html2canvas**ライブラリを使用:

```typescript
import html2canvas from 'html2canvas'

async function captureElement(elementId: string): Promise<Blob> {
  const element = document.getElementById(elementId)
  if (!element) throw new Error('Element not found')

  const canvas = await html2canvas(element, {
    backgroundColor: '#ffffff',
    scale: 2, // 高解像度化
    logging: false,
    useCORS: true, // 外部画像も取得
  })

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
    }, 'image/png')
  })
}
```

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
```

### SNS別シェア対応

#### X (Twitter)

画像付き投稿用URL生成:

```typescript
function shareToX(imageBlob: Blob, text: string, url: string) {
  // Xは画像を直接URLに含められないため、
  // 1) 画像をアップロード後、メディアIDを取得
  // 2) テキスト+URLで投稿画面を開く
  const tweetText = `${text}\n${url}`
  const xUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
  window.open(xUrl, '_blank')

  // 画像は別途ダウンロードして手動添付を促す
  downloadImage(imageBlob)
}
```

#### Bluesky

```typescript
function shareToBluesky(imageBlob: Blob, text: string, url: string) {
  const bskyText = `${text}\n${url}`
  const bskyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(bskyText)}`
  window.open(bskyUrl, '_blank')

  downloadImage(imageBlob)
}
```

#### Threads

```typescript
function shareToThreads(imageBlob: Blob, text: string, url: string) {
  const threadsText = `${text}\n${url}`
  const threadsUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent(threadsText)}`
  window.open(threadsUrl, '_blank')

  downloadImage(imageBlob)
}
```

### 画像内のMY PACE情報追加

キャプチャ前に一時的に以下の要素を追加:

```tsx
<div className="share-footer">
  <img src="/logo.svg" alt="MY PACE" className="share-logo" />
  <span className="share-url">mypace.jp</span>
</div>
```

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
<button className="word-synthesis-share-button" onClick={handleShare}>
  <Icon name="Share2" size={20} />
  <span>この発見をシェア</span>
</button>
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

- **外部画像**: `html2canvas`のCORS制限により、外部画像が含まれる場合は正しくキャプチャされない可能性あり
  - 対策: プロキシ経由で画像を取得、またはキャプチャ前に警告表示
- **パフォーマンス**: 大きな投稿カードのキャプチャには時間がかかる
  - 対策: ローディング表示、解像度の調整オプション
- **プライバシー**: 公開範囲が限定された投稿は画像シェア不可にする
  - 対策: 自分の投稿のみシェア可能、他ユーザーの投稿は制限

## 関連仕様

- [stella.md](./stella.md) - ステラ表示
- [wordrot.md](./wordrot.md) - ワードロット機能
- [repost.md](./repost.md) - リポスト機能

---

[← 拡張仕様一覧に戻る](./index.md)
