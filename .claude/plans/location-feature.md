# 座標投稿機能計画

## 概要

投稿に任意で座標（緯度・経度）を添付できる機能。
写真のEXIFとは独立した、明示的な位置情報共有。

## 背景

### 問題
- nostr.buildは写真アップロード時にEXIFを削除（プライバシー保護）
- 自宅の写真 → 位置バレしない ✓
- 旅行の写真 → 位置を共有したい ✗

### 解決策
- 写真とは無関係に座標を投稿に添付
- ユーザーの明示的な意思で位置を共有
- 意図しない位置バレを防ぎつつ、共有したい時は共有できる

## データ構造

### Nostrイベントタグ

```json
{
  "kind": 1,
  "content": "京都に来ました！\nhttps://example.com/photo.jpg",
  "tags": [
    ["t", "mypace"],
    ["mypace", "location", "35.0116", "135.7681", "京都市"]
  ]
}
```

形式: `["mypace", "location", "<緯度>", "<経度>", "<地名(任意)>"]`

### NIP-52 (Calendar Events) 参考

NIP-52では `g` タグ（geohash）を使用:
```json
["g", "u4pruydqqvj"]
```

mypaceでは緯度経度を直接使用（より直感的）。

## 表示

### タイムライン

```
┌──────────────────────────────────┐
│ @username · 2時間前              │
│                                  │
│ 京都に来ました！                  │
│ [写真]                           │
│                                  │
│ 📍 京都市 [地図を見る]            │
└──────────────────────────────────┘
```

### 地図表示オプション

1. **リンクのみ**: Google Maps / Apple Maps へのリンク
2. **埋め込み地図**: 小さな地図プレビュー（OpenStreetMap等）
3. **モーダル地図**: クリックで大きな地図表示

## 投稿UI

### 位置追加ボタン

```
[📷] [🎨] [🎤] [📍] [投稿]
                 ↑
            位置を追加
```

### 位置入力モーダル

```
┌─ 位置を追加 ─────────────────────┐
│                                  │
│ [🔍 現在地を取得]                 │
│                                  │
│ または                           │
│                                  │
│ [地図から選択]                    │
│ ┌────────────────────────────┐  │
│ │       地図表示              │  │
│ │         📍                 │  │
│ │                            │  │
│ └────────────────────────────┘  │
│                                  │
│ 緯度: [35.0116    ]              │
│ 経度: [135.7681   ]              │
│ 地名: [京都市      ] (任意)       │
│                                  │
│ [キャンセル]        [追加]        │
└──────────────────────────────────┘
```

### 位置取得方法

1. **現在地**: Geolocation API
2. **地図から選択**: 地図クリックで座標取得
3. **手動入力**: 緯度経度を直接入力
4. **検索**: 地名検索 → 座標変換（Nominatim等）

## 実装

### Geolocation API

```typescript
async function getCurrentLocation(): Promise<{lat: number, lng: number}> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }),
      (err) => reject(err),
      { enableHighAccuracy: true }
    )
  })
}
```

### 地図リンク生成

```typescript
function getMapUrl(lat: number, lng: number): string {
  // Google Maps
  return `https://www.google.com/maps?q=${lat},${lng}`

  // または OpenStreetMap
  // return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`
}
```

### 逆ジオコーディング（座標→地名）

```typescript
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
  )
  const data = await res.json()
  return data.display_name || ''
}
```

## プライバシー考慮

### 警告表示

位置追加時に確認:
```
⚠️ 位置情報は公開されます
この投稿を見た人に座標が見えます。
自宅など、共有したくない場所の位置は追加しないでください。

[キャンセル] [理解して追加]
```

### 精度調整オプション

- **正確な位置**: そのまま（旅行スポット向け）
- **おおまかな位置**: 小数点以下2桁に丸める（都市レベル）

```typescript
function roundLocation(lat: number, lng: number, precision: 'exact' | 'rough') {
  if (precision === 'rough') {
    return {
      lat: Math.round(lat * 100) / 100,  // 約1km精度
      lng: Math.round(lng * 100) / 100
    }
  }
  return { lat, lng }
}
```

## 拡張案

### 位置検索タイムライン

- 「この場所の投稿を見る」
- 地図上に投稿をプロット
- 旅行記録として使える

### チェックイン機能

- 「今ここにいます」ボタン
- Foursquare/Swarm的な使い方

### 位置履歴

- 自分の投稿を地図上に表示
- 旅行の軌跡を可視化

## 実装優先度

1. 基本座標添付（タグ追加）
2. 位置追加UI（現在地取得）
3. タイムライン表示（📍アイコン + リンク）
4. 地図から選択UI
5. 埋め込み地図表示
6. 位置検索タイムライン
