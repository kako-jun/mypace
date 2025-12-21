# お絵かき機能（Splatoon風）

投稿にシンプルなお絵かきを添付できる機能。

## 背景

- スプラトゥーンの広場投稿のような、制約のあるお絵かき
- 制約があるから味が出る
- 絵が下手でも「味」になる
- 42秒という時間制限で緊張感

## 仕様

| 項目 | 値 |
|------|-----|
| キャンバスサイズ | 320×120px（スプラトゥーン準拠） |
| 色 | 黒 / 灰 / 白（消しゴム代わり） |
| ペン太さ | 小(2px) / 中(6px) / 大(14px) |
| 制限時間 | 42秒 |
| 出力形式 | WebP |

## UI

### ツールバー

```
[ ● 黒 ] [ ● 灰 ] [ ○ 白 ]  |  [ 小 ] [ 中 ] [ 大 ]  |  [ ↩ Undo ] [ 🗑 Clear ]

                         [ 00:42 タイマー ]

         ┌─────────────────────────────────────┐
         │                                     │
         │          320×120 キャンバス          │
         │                                     │
         └─────────────────────────────────────┘

                    [ 完了 ]  [ キャンセル ]
```

### 操作

- **色選択**: 黒/灰/白をクリック（白は消しゴム代わり）
- **太さ選択**: 小/中/大をクリック
- **Undo**: 直前のストロークを取り消し
- **Clear**: 全消去（白で塗りつぶし）
- **タイマー**: 最初のストロークで開始、0になっても描画中のものは完了可能

### タイマー動作

1. モーダルを開いた時点ではタイマーは停止
2. 最初のストローク（描き始め）でタイマー開始
3. 残り10秒で赤色点滅
4. 0秒になると新規ストローク不可（完了ボタンは押せる）

## 技術実装

### Canvas API

```typescript
const canvas = document.getElementById('canvas')
const ctx = canvas.getContext('2d')

// 白背景で初期化
ctx.fillStyle = '#ffffff'
ctx.fillRect(0, 0, 320, 120)

// 描画設定
ctx.strokeStyle = '#000000'  // 黒
ctx.lineWidth = 6            // 中サイズ
ctx.lineCap = 'round'
ctx.lineJoin = 'round'
```

### WebP出力

```typescript
canvas.toBlob((blob) => {
  const file = new File([blob], 'drawing.webp', { type: 'image/webp' })
  // nostr.buildにアップロード
}, 'image/webp', 0.9)
```

### Undo実装

ストローク単位で履歴を保存し、Undo時にキャンバスを再描画:

```typescript
interface DrawAction {
  type: 'stroke'
  color: string
  size: number
  points: { x: number; y: number }[]
}

// Undo時
history.pop()
redrawCanvas()  // 白で塗りつぶし後、全ストロークを再描画
```

## ボタン配置

投稿フォームのRow2に配置:

```
Row1: [Avatar] [ファイル] [@@] ---- [LONG/Vim] [Minimize]
Row2: [カメラ] [シール] [お絵かき] [録音] [座標]
```

## アップロード

- nostr.buildにWebP形式でアップロード
- NIP-98認証を使用
- アップロード成功後、URLが本文に挿入される

## 削除について

- nostr.buildにアップロードしたファイルは削除不可
- 投稿前に確認が必要

## 他クライアントでの表示

お絵かきは通常の画像URLとして投稿されるため、他のNostrクライアントでも画像として表示される。

## 将来の拡張

- スタンプ/図形ツール（検討中）
