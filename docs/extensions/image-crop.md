# 画像クロップ機能

アップロード前に画像をトリミングできる機能。

## 背景

- 画像の不要な部分を事前にカットしたい
- スマホで撮った画像は余白が多いことがある
- アップロード後は変更できない

## 仕様

| 項目 | 値 |
|------|-----|
| 対応形式 | 画像ファイル全般（PNG, JPG, WebP等） |
| 初期状態 | 画像全体を選択 |
| 出力形式 | 元の形式を維持 |
| 出力品質 | 95% |

## UI

### クロップモーダル

画像選択後に表示されるモーダル:

```
┌─────────────────────────────────────────────────┐
│ Crop Image                                    × │
├─────────────────────────────────────────────────┤
│                                                 │
│    ┌───────────────────────────────────┐       │
│    │                                   │       │
│    │     [ 選択範囲（ドラッグ可能）]     │       │
│    │                                   │       │
│    └───────────────────────────────────┘       │
│                                                 │
│         Drag to select crop area               │
│                                                 │
│                     [ Cancel ]  [ Add ]        │
└─────────────────────────────────────────────────┘
```

### 操作

- **ドラッグ**: クロップ範囲を選択
- **角をドラッグ**: サイズ変更
- **範囲内をドラッグ**: 位置移動
- **Cancel**: クロップをキャンセル
- **Add**: 選択範囲で切り取り、アップロード

## 対象

以下のアップロードでクロップ可能:

1. **画像添付** - Row2の画像ボタン
2. **ステッカー画像** - ローカルファイルからのステッカー追加

## 技術実装

### react-image-crop

```typescript
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop'

<ReactCrop
  crop={crop}
  onChange={(c) => setCrop(c)}
  onComplete={handleCropComplete}
>
  <img src={imageSrc} />
</ReactCrop>
```

### Canvas API でクロップ

```typescript
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')

// 選択範囲のサイズでキャンバス作成
canvas.width = completedCrop.width * scaleX
canvas.height = completedCrop.height * scaleY

// 選択範囲を描画
ctx.drawImage(
  image,
  completedCrop.x * scaleX,
  completedCrop.y * scaleY,
  completedCrop.width * scaleX,
  completedCrop.height * scaleY,
  0, 0,
  canvas.width, canvas.height
)

// Blobに変換
canvas.toBlob((blob) => {
  const croppedFile = new File([blob], file.name, { type: file.type })
  // アップロード処理へ
}, file.type, 0.95)
```

## ボタン配置

投稿フォームのRow2:

```
Row2: [カメラ] [シール] [お絵かき] [録音] [座標]
         ↑
    クロップ付き
```

## 注意事項

- クロップはアップロード前のみ可能
- アップロード後のファイルは変更不可
- 元画像は保持されない（クロップ後のみ送信）

## 削除について

- nostr.buildにアップロードしたファイルは削除可能
- 削除には [Upload History](./upload-history.md) 機能を使用
