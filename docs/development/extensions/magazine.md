# マガジン機能

自分の投稿をまとめて公開できるコレクション機能。noteのマガジン、Zennのブックに相当。

## 概要

ユーザーが自分の投稿を複数まとめて「マガジン」として公開できる。
訪問者はマガジン単位で投稿を閲覧でき、シリーズ記事や作品集として活用できる。

## UI

### ユーザーページのレイアウト

マガジンセクションはピン留め投稿・検索フィルターより上に配置。

```
+----------------------------------+
| UserProfile                      |
+----------------------------------+
| Magazines (横スクロール)         |  <- NEW
| [マガジン1] [マガジン2] [+ 作成] |
+----------------------------------+
| Pinned                           |
| [ピン留め投稿]                   |
+----------------------------------+
| Search / Filter                  |
+----------------------------------+
| Posts                            |
| [投稿一覧...]                    |
+----------------------------------+
```

### マガジンカード

一覧表示用のコンパクトなカード。

```
+------------------+
| [サムネイル画像] |
| マガジンタイトル |
| 3 posts          |
+------------------+
```

### マガジンに追加（シェアメニュー内）

自分の投稿のシェアメニューに「マガジンに追加」オプションを表示。

```
[📤 Share] クリック
    ↓
+-------------------+
| SNS共有           |
| URLシェア         |
| コンテンツシェア  |
| ─────────────────|
| 📚 マガジンに追加 |  <- 自分の投稿のみ表示
+-------------------+
    ↓ クリック
+-------------------+
| マガジンを選択    |
| ─────────────────|
| □ マガジン1       |
| ☑ マガジン2       |
| ─────────────────|
| [+ 新規作成]      |
+-------------------+
```

### マガジン詳細ページ

```
+----------------------------------+
| [サムネイル画像]                 |
| マガジンタイトル                 |
| by @username                     |
| 説明文...                        |
| [📤 Share] [✏️ Edit]            |
+----------------------------------+
| 含まれる投稿（順序付き）         |
| 1. [投稿カード] [↑↓][×]         |  <- オーナーのみ操作可
| 2. [投稿カード] [↑↓][×]         |
| ...                              |
+----------------------------------+
```

### マガジン作成/編集モーダル

```
+----------------------------------+
| マガジンを作成                   |
+----------------------------------+
| タイトル: [___________________]  |
| スラッグ: [___________________]  |
|           (URLに使用される識別子) |
| 説明:                            |
| [_____________________________]  |
|                                  |
| サムネイル:                      |
| [画像選択] または [URL入力]      |
|                                  |
|        [キャンセル] [保存]       |
+----------------------------------+
```

## データ構造

### Nostrイベント（Kind 30001）

NIP-51のPublic Setsをベースに、マガジン用タグを追加。

```typescript
{
  kind: 30001,  // NIP-51 Public Sets (replaceable)
  pubkey: "作成者のpubkey",
  tags: [
    ["d", "magazine-slug"],           // 一意な識別子（URLに使用）
    ["title", "マガジンタイトル"],
    ["description", "マガジンの説明"],
    ["image", "https://..."],         // サムネイル画像URL
    ["t", "mypace-magazine"],         // MY PACEマガジン識別用
    ["e", "event_id_1", "relay_url"], // 含まれる投稿1
    ["e", "event_id_2", "relay_url"], // 含まれる投稿2
    // ... 投稿の順序はタグの順序で表現
  ],
  content: "",  // 空または詳細説明
  created_at: timestamp
}
```

**ポイント:**
- `d`タグでスラッグを指定（replaceable eventの識別子）
- `t`タグに`mypace-magazine`を付与してMY PACEマガジンと識別
- `e`タグの順序が投稿の表示順序
- 同じ`d`タグで再発行すると更新される（NIP-33 replaceable event）

### D1テーブル（補助データ）

```sql
CREATE TABLE magazine_views (
  naddr TEXT PRIMARY KEY,      -- NIP-19 naddr形式の識別子
  pubkey TEXT NOT NULL,        -- 作成者pubkey
  d_tag TEXT NOT NULL,         -- スラッグ
  view_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_magazine_views_pubkey ON magazine_views(pubkey);
```

## URL

| ページ | URL |
|--------|-----|
| マガジン詳細 | `/user/:npub/magazine/:slug` |

例: `/user/npub1abc.../magazine/my-first-series`

## API

### GET /api/magazine/:npub/:slug/ogp

OGPメタデータ取得（動的OGP生成用）。

**レスポンス:**
```json
{
  "title": "マガジンタイトル",
  "description": "説明...",
  "image": "https://...",
  "author": "npub1abc...",
  "postCount": 5
}
```

### POST /api/magazine/views

View記録。

**リクエスト:**
```json
{
  "naddr": "naddr1...",
  "pubkey": "hex_pubkey",
  "dTag": "magazine-slug"
}
```

## OGP

マガジン詳細ページで動的OGPを生成。

```html
<meta property="og:title" content="マガジンタイトル" />
<meta property="og:description" content="説明... | 5 posts" />
<meta property="og:image" content="サムネイルURL" />
<meta property="og:url" content="https://mypace.app/user/npub.../magazine/slug" />
<meta property="og:type" content="article" />
```

## シェアメニュー

マガジン詳細ページのシェアメニュー。既存のShareMenuを流用。

| オプション | 内容 |
|-----------|------|
| URLコピー | `/user/:npub/magazine/:slug` |
| Web Share API | タイトル + URL |
| X共有 | `📚 [タイトル] by @username URL` |
| Bluesky共有 | 同上 |
| Threads共有 | 同上 |

## 制限

- 自分の投稿のみマガジンに追加可能（他人の投稿は対象外）
- 1マガジンあたり最大100投稿（イベントサイズ制限考慮）
- スラッグは英数字・ハイフンのみ、最大50文字
- タイトルは最大100文字
- 説明は最大500文字

## 操作フロー

### マガジン作成

```
[ユーザーページ] → [+ 作成ボタン] → [モーダル入力] → [保存]
    ↓
Kind 30001 イベント作成 → 署名 → リレーに送信
```

### 投稿をマガジンに追加

```
[投稿カード] → [シェアメニュー] → [マガジンに追加] → [マガジン選択]
    ↓
既存Kind 30001に e タグ追加 → 署名 → リレーに送信（置換）
```

### マガジンから投稿を削除

```
[マガジン詳細ページ] → [× ボタン] → [確認]
    ↓
Kind 30001から該当 e タグ削除 → 署名 → リレーに送信（置換）
```

### 投稿の並び替え

```
[マガジン詳細ページ] → [↑↓ ボタン]
    ↓
Kind 30001の e タグ順序変更 → 署名 → リレーに送信（置換）
```

## コンポーネント構成

| コンポーネント | 場所 | 役割 |
|--------------|------|------|
| `MagazineSection` | `components/user/` | ユーザーページ内マガジン一覧 |
| `MagazineCard` | `components/magazine/` | マガジンカード表示 |
| `MagazineView` | `components/magazine/` | マガジン詳細ページ |
| `MagazineEditor` | `components/magazine/` | 作成/編集モーダル |
| `AddToMagazineMenu` | `components/post/` | シェアメニュー内サブメニュー |

## 他クライアントとの互換性

- Kind 30001はNIP-51準拠のため、対応クライアントでリストとして表示可能
- `t:mypace-magazine`タグでMY PACE専用と識別
- 非対応クライアントでは無視される（正常動作）

## 使用箇所

- **ユーザーページ**: UserView → MagazineSection
- **マガジン詳細**: /user/:npub/magazine/:slug → MagazineView
- **投稿カード**: ShareMenu → AddToMagazineMenu（自分の投稿のみ）
