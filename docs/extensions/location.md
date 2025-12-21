# 座標投稿機能

投稿に場所情報を添付できる機能。

## 概要

写真のEXIFや現在地とは無関係に、ユーザーが明示的に場所を指定して投稿。
レビューサイト的な使い方。「ここに行った感想」を書くときに使う。

## ユースケース

```
@@金閣寺

紅葉の時期が最高だった

📍 金閣寺 [地図を見る]
```

## タグ形式

### Nostrイベント（NIP-52準拠）

```json
{
  "kind": 1,
  "content": "金閣寺に行ってきた！",
  "tags": [
    ["t", "mypace"],
    ["g", "xn76urx1"],
    ["location", "金閣寺"]
  ]
}
```

| タグ | 必須 | 説明 |
|------|------|------|
| `g` | ○ | geohash（精度選択可能） |
| `location` | △ | 地名（表示用、任意） |

### Geohash精度

| 文字数 | 精度 | 用途 |
|--------|------|------|
| 6 | ±610m | Area（町・エリア） |
| 7 | ±76m | Street（通り） |
| 8 | ±19m | Building（建物）※デフォルト |
| 9 | ±2m | Precise（正確な位置） |

## 投稿UI

### 座標ボタン

エディタの2行目（添付ボタン行）に📍アイコンのボタン。

```
[Avatar]                         [LONG ↗] [−]
[📁] [@@] [📷] [🎨] [📍]
─────────────────────────────────────────────
[テキストエリア                              ]
```

### LocationPickerモーダル

```
┌─ Add Location ─────────────────────────[×]─┐
│                                            │
│ [検索テキスト              ] [🔍]          │
│                                            │
│ ├ 📍 金閣寺（京都市北区金閣寺町）          │
│ ├ 📍 金閣寺前バス停                        │
│ └ 📍 金閣寺道                              │
│                                            │
│ [Map] [Satellite]                          │
│ ┌──────────────────────────────────────┐  │
│ │                                      │  │
│ │         Leaflet地図表示              │  │
│ │            📍 ← ドラッグで微調整      │  │
│ │                                      │  │
│ └──────────────────────────────────────┘  │
│                                            │
│ Precision: [Building (±19m) ▼]             │
│                                            │
│                    [Cancel] [Add Location] │
└────────────────────────────────────────────┘
```

### フロー

1. 座標ボタンをクリック → LocationPickerモーダル表示
2. 施設名で検索 → 検索ボタン押下でNominatim API
3. 候補から選択 → 地図にピン表示、ズーム
4. 微調整（任意）→ ピンをドラッグ
5. 精度選択 → geohash文字数（6〜9）
6. 「Add Location」→ タグ追加、モーダル閉じる

※ オートコンプリート（入力中に候補表示）はNominatim利用規約で禁止

### 座標表示

座標を追加すると、2行目に表示される:

```
[📁] [@@] [📷] [🎨] [📍] [📍 金閣寺 ×]
```

×ボタンで削除可能。

## タイムライン表示

```
┌──────────────────────────────────────────┐
│ @username · 2時間前                       │
│                                          │
│ 金閣寺に行ってきた！                       │
│ [写真]                                    │
│                                          │
│ [📍 金閣寺]  ← クリックでOSM地図を開く     │
│                                          │
│ ★★★  💬2  🔁1  📤                        │
└──────────────────────────────────────────┘
```

クリックでOpenStreetMapの該当座標を新しいタブで開く:
```
https://www.openstreetmap.org/?mlat={lat}&mlon={lng}&zoom=17
```

## 技術スタック

| 機能 | ツール | 料金 |
|------|--------|------|
| 地名検索 | Nominatim | 無料（1秒1リクエスト制限） |
| 地図表示 | Leaflet | 無料 |
| 地図タイル | OpenStreetMap | 無料 |
| 航空写真 | ESRI Satellite | 無料 |
| geohash変換 | ngeohash | 無料 |

### 依存パッケージ

```bash
pnpm add leaflet ngeohash
pnpm add -D @types/leaflet @types/ngeohash
```

## コンポーネント構成

```
components/
  location/
    LocationPicker.tsx  # モーダルコンポーネント
    index.ts
  post/
    PostLocation.tsx    # タイムライン表示コンポーネント
```

## 他クライアントでの表示

`g`タグはNIP-52準拠のため、対応クライアントでは地図表示される可能性がある。
`location`タグはmypace独自拡張のため、他クライアントでは無視される。

## 参考

- [NIP-52 Calendar Events](https://github.com/nostr-protocol/nips/blob/master/52.md) - `g`タグ仕様
- [Nominatim Usage Policy](https://operations.osmfoundation.org/policies/nominatim/) - 利用規約
- [Leaflet](https://leafletjs.com/) - 地図ライブラリ
- [ngeohash](https://github.com/sunng87/node-geohash) - geohashライブラリ
