# sticker（シール機能）

投稿カードの上に画像を自由配置できる「シール」機能。

## 背景

- LINEのスタンプ文化のように、独自のシール文化を作りたい
- ヴィレバン的な安っぽいPOP感の演出
- 投稿に視覚的なアクセントを追加

## タグ形式

```json
["sticker", "<url>", "<x>", "<y>", "<size>", "<rotation>"]
```

- **url**: シール画像のURL
- **x**: 左からの位置（0-100%）
- **y**: 上からの位置（0-100%）
- **size**: 幅（5-100%）
- **rotation**: 回転角度（0-360度、オプション、デフォルト0）

## イベント形式

Kind 1に`sticker`タグを追加:

```json
{
  "kind": 1,
  "content": "新商品のお知らせ",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://example.com/new-label.png", "85", "5", "20", "15"]
  ]
}
```

複数のシールを貼る場合は複数のタグを追加:

```json
{
  "kind": 1,
  "content": "特別セール開催中！",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://example.com/sale.png", "80", "10", "25", "0"],
    ["sticker", "https://example.com/limited.png", "5", "5", "18", "45"]
  ]
}
```

## 表示ロジック

### タグ解析（lib/nostr/tags.ts）

```typescript
function parseStickers(tags: string[][]): Sticker[] {
  return tags
    .filter((t) => t[0] === 'sticker' && t.length >= 5)
    .map((t) => ({
      url: t[1],
      x: Math.max(0, Math.min(100, parseInt(t[2], 10) || 0)),
      y: Math.max(0, Math.min(100, parseInt(t[3], 10) || 0)),
      size: Math.max(5, Math.min(100, parseInt(t[4], 10) || 15)),
      rotation: t[5] ? Math.max(0, Math.min(360, parseInt(t[5], 10) || 0)) : 0,
    }))
    .filter((s) => s.url)
}
```

### Sticker型（types/index.ts）

```typescript
interface Sticker {
  url: string    // Image URL
  x: number      // Position from left (0-100%)
  y: number      // Position from top (0-100%)
  size: number   // Width (5-100%)
  rotation: number // Rotation angle (0-360 degrees)
}
```

## 投稿UI

### シール選択

1. エディタ上部のシールアイコンをクリック
2. モーダルからシールを選択（中央に配置される）

### Photoshop風編集

シールを選択すると:

- **バウンディングボックス**: 青い破線で囲まれる
- **リサイズハンドル**: 四隅の青い丸をドラッグでサイズ変更
- **回転ハンドル**: 上部中央の緑の丸をドラッグで回転
- **ドラッグ移動**: シール本体をドラッグで位置移動
- **選択解除**: 外側クリックまたはESCキー

### 操作

- マウス/タッチ両対応
- モバイルでは大きめのハンドル表示（タッチしやすい）
- 位置は0-100%の範囲でクランプ（はみ出し防止）
- 最大10枚まで

## コンポーネント構成

```
PostStickers (表示/編集共通)
├── sticker-wrapper (位置・回転・サイズ適用)
│   ├── post-sticker (画像)
│   ├── sticker-bbox (バウンディングボックス)
│   ├── sticker-handle-resize × 4 (四隅)
│   ├── sticker-rotate-line (回転ライン)
│   └── sticker-handle-rotate (回転ハンドル)
```

## 使用箇所

- **タイムライン**: TimelinePostCard → PostStickers（表示のみ）
- **詳細ページ**: PostView → PostStickers（表示のみ）
- **投稿プレビュー**: PostPreview → PostStickers（編集可能）
- **編集時**: 既存シールを復元、再配置可能

## 編集時の復元

編集モードでは既存のシールタグを解析し、シールを復元。
位置・サイズ・回転すべて保持される。

## 他クライアントでの表示

stickerタグはmypace独自拡張のため、他のNostrクライアントでは無視される。
本文のみが表示され、シールは見えない。

## 将来の拡張

- カスタムシールのアップロード
- シールコレクションの共有
- Zapでシールを売買できる経済圏
