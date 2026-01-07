# sticker（シール機能）

投稿カードの上に画像を自由配置できる「シール」機能。

## 背景

- LINEのスタンプ文化のように、独自のシール文化を作りたい
- ヴィレバン的な安っぽいPOP感の演出
- 投稿に視覚的なアクセントを追加

## タグ形式

```json
["sticker", "<url>", "<x>", "<y>", "<size>", "<rotation>", "<quadrant>", "<layer>"]
```

- **url**: シール画像のURL
- **x**: 象限内での位置（0-100%）
- **y**: 象限内での位置（0-100%）
- **size**: 幅（5-100%）
- **rotation**: 回転角度（0-360度）
- **quadrant**: 基準コーナー（`top-left`, `top-right`, `bottom-left`, `bottom-right`）
- **layer**: レイヤー（`front`=テキストの前面, `back`=テキストの背面）※省略時はfront

## 象限システム

シールは4つのコーナーのいずれかを基準に配置される:

```
┌───────────┬───────────┐
│ top-left  │ top-right │
├───────────┼───────────┤
│bottom-left│bottom-right│
└───────────┴───────────┘
```

ドラッグでカード中央を越えると、最も近いコーナーにスナップ。
これにより、カードサイズに関わらず相対位置が維持される。

## イベント形式

Kind 1に`sticker`タグを追加:

```json
{
  "kind": 1,
  "content": "新商品のお知らせ",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://example.com/new-label.png", "85", "5", "20", "15", "top-right"]
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
    ["sticker", "https://example.com/sale.png", "80", "10", "25", "0", "top-right"],
    ["sticker", "https://example.com/limited.png", "5", "5", "18", "45", "top-left", "back"]
  ]
}
```

上記の例では、`sale.png`は前面（デフォルト）、`limited.png`は背面に表示される。

## 表示ロジック

### タグ解析（lib/nostr/tags.ts）

```typescript
function parseStickers(tags: string[][]): Sticker[] {
  const validQuadrants = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
  return tags
    .filter((t) => t[0] === 'sticker' && t.length >= 5)
    .map((t) => ({
      url: t[1],
      x: Math.max(0, Math.min(100, parseInt(t[2], 10) || 0)),
      y: Math.max(0, Math.min(100, parseInt(t[3], 10) || 0)),
      size: Math.max(5, Math.min(100, parseInt(t[4], 10) || 15)),
      rotation: t[5] ? Math.max(0, Math.min(360, parseInt(t[5], 10) || 0)) : 0,
      quadrant: validQuadrants.includes(t[6]) ? t[6] : 'top-left',
    }))
    .filter((s) => s.url)
}
```

### Sticker型（types/index.ts）

```typescript
type StickerQuadrant = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
type StickerLayer = 'front' | 'back'

interface Sticker {
  url: string              // 画像URL
  x: number                // 象限内での位置（0-100%）
  y: number                // 象限内での位置（0-100%）
  size: number             // 幅（5-100%）
  rotation: number         // 回転角度（0-360度）
  quadrant: StickerQuadrant // 基準コーナー
  layer?: StickerLayer     // レイヤー（front=前面, back=背面）※省略時はfront
}
```

## 投稿UI

### 画像ピッカー（ImagePicker）

エディタのシールアイコンをクリックすると「Select Image」モーダルが開く。
画像添付機能とシール機能が統合されており、画像選択後に用途を選べる。

#### レイアウト

```
┌─────────────────────────────────┐
│ Select Image               [×] │
├─────────────────────────────────┤
│ [Upload (ドラッグ&ドロップ対応)]  │
│                                 │
│ [🖼] URL欄                       │
│                                 │
│ ┌─────────┐                     │
│ │ preview │                     │
│ └─────────┘                     │
├─────────────────────────────────┤
│ 履歴グリッド                     │
├─────────────────────────────────┤
│          [Embed] [Sticker]     │
└─────────────────────────────────┘
```

#### 画像選択フロー

**アップロードから:**
1. Uploadボタンをクリック、またはエリアにドラッグ&ドロップ
2. クロップモーダルが開く（アニメGIF等は自動スキップ）
3. クロップ完了後、URL欄にURLが入り、プレビュー表示

**URL入力から:**
1. URL欄に既存画像のURLを入力
2. プレビューに画像が表示される

**履歴から:**
1. 履歴グリッドの画像をクリック
2. URL欄にURLが入り、プレビュー表示

#### 用途選択

画像選択後、下部の2つのボタンから用途を選ぶ（右詰め配置）:

- **Embed**: エディタの現在位置にURLを挿入（従来の画像添付）
- **Sticker**: シールとして追加（カード上に自由配置）

### Photoshop風編集

シールを選択すると:

- **バウンディングボックス**: 青い破線で囲まれる
- **リサイズハンドル**: 四隅の青い丸をドラッグでサイズ変更
- **回転ハンドル**: 上部中央の緑の丸をドラッグで回転
- **レイヤー切り替え**: 下部中央のiOS風トグルスイッチで前面/背面を切り替え
- **削除ボタン**: 右上の赤い×ボタンでシールを削除
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
│   ├── sticker-handle-rotate (回転ハンドル)
│   ├── sticker-layer-line (レイヤーライン)
│   ├── sticker-layer-toggle (レイヤー切り替えスイッチ)
│   └── sticker-handle-delete (削除ボタン)
```

### 2層レンダリング

投稿カードでは背面シールと前面シールを別々にレンダリング:

```tsx
<article className="post-card">
  <PostStickers layer="back" />   {/* z-index: 0 */}
  <PostHeader />                   {/* z-index: 1 */}
  <PostContent />                  {/* z-index: 1 */}
  <PostFooter />                   {/* z-index: 1 */}
  <PostStickers layer="front" />  {/* z-index: 10 */}
</article>
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

## シール履歴

サーバーサイドでシールの使用履歴を追跡:

```sql
CREATE TABLE sticker_history (
  url TEXT PRIMARY KEY,
  first_used_by TEXT,      -- 最初に使用したユーザーのnpub
  use_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**APIエンドポイント:**
- `GET /api/sticker/history` - 人気シール取得
- `POST /api/sticker/save` - 使用履歴記録
- `DELETE /api/sticker/delete` - 履歴から削除（誰でも削除可能）

### 履歴の削除

シール選択モーダルで、履歴アイテムにホバーすると×ボタンが表示される。
クリックで履歴から削除される。認証不要で誰でも削除可能（コミュニティモデレーション）。

## 将来の拡張

- シールコレクションの共有
- Zapでシールを売買できる経済圏
