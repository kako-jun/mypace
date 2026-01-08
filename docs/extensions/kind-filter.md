# Kind Filter（投稿種別フィルタ）

タイムラインに表示する投稿の種別（Kind）を選択できる機能。
SNS投稿（Kind 1）とブログ記事（Kind 30023）を独立してオン/オフできる。

## 背景・狙い

- Nostrにはさまざまな種類の投稿がある
  - Kind 1: 短文投稿（Twitter/Xのようなもの）
  - Kind 30023: 長文記事（ブログ、NIP-23）
- 短文投稿が多いため、ブログ記事がタイムラインに埋もれて見つけられない
- ブログだけを読みたい、SNSだけを見たいというニーズがある

## 回路図的フィルタモデル

左から右へデータが流れる回路図のようなイメージ：

```
              ┌─── [SNS (1)]  ────┐
              │        □         │
[Nostr全体] ──┤                   ├── [MY PACE] ──→ Timeline
              │                   │       □
              └─── [Blog (30023)] ┘
                        □
```

- 各□はトグルスイッチ
- SNS（Kind 1）とBlog（Kind 30023）は独立したスイッチ
- さらにMY PACEフィルタで#mypaceタグ付きのみに絞れる

## フィルタ設定

### showSNS

- `true`: Kind 1（短文投稿）を表示
- `false`: Kind 1を非表示
- デフォルト: `true`

### showBlog

- `true`: Kind 30023（長文記事）を表示
- `false`: Kind 30023を非表示
- デフォルト: `true`

### 組み合わせ

| showSNS | showBlog | 表示内容 |
|---------|----------|----------|
| true    | true     | すべて（デフォルト） |
| true    | false    | SNSのみ |
| false   | true     | ブログのみ |
| false   | false    | 何も表示されない |

## 保存方法

フィルタ設定は **localStorage** に保存され、APIリクエスト時にパラメータとして送信。
ブラウザURLには含まれない（共有URLに個人設定が漏れない）。

## API仕様

### タイムライン取得

```
GET /api/timeline?kinds=1,30023
```

`kinds`パラメータで取得するKindを指定：
- `kinds=1` - SNSのみ
- `kinds=30023` - ブログのみ
- `kinds=1,30023` - 両方（デフォルト）

### サーバー側処理

```typescript
// kindsパラメータをパース
const kindsParam = c.req.query('kinds')
const kinds = kindsParam
  ? kindsParam.split(',').map(k => parseInt(k, 10)).filter(k => !isNaN(k))
  : [1, 30023]

// キャッシュクエリ
const kindPlaceholders = kinds.map(() => '?').join(',')
const query = `
  SELECT * FROM events
  WHERE kind IN (${kindPlaceholders}) AND ...
`

// リレークエリ
const filter: Filter = { kinds, ... }
```

## UI仕様

### フィルタパネル

回路図風のレイアウトで表示：

```
┌───────────────────────────────────────────────┐
│  [Nostr] ─┬─ SNS ──────┬─ MY PACE ──→        │
│           │     [□]    │     [□]             │
│           └─ Blog ─────┘                      │
│                 [□]                           │
├───────────────────────────────────────────────┤
│  OK  [キーワード入力]  [タグ入力]             │
│  NG  [除外ワード入力]  [除外タグ入力]         │
│                                               │
│  [Clear]                        [Save]        │
└───────────────────────────────────────────────┘
```

### スイッチの状態

- オン: 塗りつぶし、接続線がアクティブ
- オフ: 空白、接続線がグレーアウト

### 少なくとも1つはオン

SNSとBlogの両方がオフの場合は警告を表示するか、
UIで両方オフにできないようにすることを推奨。

## 実装詳細

### 型定義

```typescript
interface SearchFilters {
  showSNS: boolean     // Kind 1を表示
  showBlog: boolean    // Kind 30023を表示
  mypace: boolean      // #mypaceタグのみ
  // ... 他のフィルタ
}
```

### デフォルト値

```typescript
const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  showSNS: true,
  showBlog: true,
  mypace: true,
  // ...
}
```

### クライアント側

```typescript
// kindsを構築
const kindsList: number[] = []
if (showSNS) kindsList.push(1)
if (showBlog) kindsList.push(30023)
params.set('kinds', kindsList.join(','))
```

## 他のNostrクライアントとの互換性

- Kind 1とKind 30023はNostr標準仕様
- フィルタ機能はmypace独自だが、データ自体は標準形式
- 他のクライアントでも同じ投稿を閲覧可能

## ユースケース

### ブログだけ読みたい

1. フィルタパネルを開く
2. SNSスイッチをオフに
3. Blogスイッチはオンのまま
4. Save

→ 長文記事のみが表示され、じっくり読める

### SNSだけ見たい

1. フィルタパネルを開く
2. Blogスイッチをオフに
3. SNSスイッチはオンのまま
4. Save

→ 短文投稿のみが表示され、サクサク流し読み

## 将来の拡張

- Kind 6（リポスト）の表示/非表示
- Kind 7（リアクション）の表示（通知画面）
- カスタムKindのサポート
