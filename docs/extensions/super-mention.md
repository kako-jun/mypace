# スーパーメンション（万物への言及）

> **「万物の擬人化」** - ハンチョウに「面白かったで」、酸素に「いつもありがとう」と呼びかける

## 概要

`@/` 構文を使って、この世のあらゆるものに対してコメントできる機能。

通常のメンション `@user` が人への呼びかけなら、スーパーメンション `@/` は万物への呼びかけ。

```
@/manga/ハンチョウ

宮本さんのセリフ、ぐっときた

#mypace
```

## 構文

```
@/カテゴリ/対象
@/カテゴリ/対象/詳細
```

- `@/` で始まる
- `/` で階層を区切る
- UTF-8 文字列（日本語OK）
- スペースは使用不可（代わりにハイフンかアンダースコア）
- 推奨は2階層まで（サジェストUIができるまで）

## トップレベルカテゴリ

| カテゴリ | 用途 | アイコン | 例 |
|----------|------|----------|-----|
| `@/manga/` | 漫画 | BookOpen | `@/manga/ハンチョウ` |
| `@/anime/` | アニメ | Clapperboard | `@/anime/エヴァンゲリオン` |
| `@/game/` | ゲーム | Gamepad2 | `@/game/ポケモン` |
| `@/movie/` | 映画 | Film | `@/movie/千と千尋の神隠し` |
| `@/music/` | 音楽 | Music | `@/music/YOASOBI/アイドル` |
| `@/book/` | 書籍 | Book | `@/book/村上春樹/ノルウェイの森` |
| `@/tech/` | 技術・プログラミング | Code | `@/tech/react` |
| `@/place/` | 場所 | MapPin | `@/place/東京/渋谷` |
| `@/person/` | 人物 | User | `@/person/宮崎駿` |
| `@/thing/` | 物・概念 | Lightbulb | `@/thing/酸素` |
| `@/web/` | Webサイト（URL） | Globe | `@/web/https://example.com` |

※ アイコンは [Lucide](https://lucide.dev/) を使用

## Nostrタグへの変換

投稿時、スーパーメンションは `t` タグに変換される。

**投稿内容:**
```
@/manga/ハンチョウ

20巻の宮本さん、最高だった
```

**Nostrイベント:**
```json
{
  "kind": 1,
  "content": "@/manga/ハンチョウ\n\n20巻の宮本さん、最高だった",
  "tags": [
    ["t", "mypace"],
    ["t", "/manga/ハンチョウ"]
  ]
}
```

- `t` タグを使用（既存のNostr仕様に準拠）
- `/` 始まりで通常のハッシュタグと区別
- 他のNostrクライアントでもタグとして表示される

## URL参照

`@/web/` カテゴリでURLを参照できる。

```
@/web/https://example.com/article/123

この記事について思うこと
```

URLへの言及は `r` タグも追加される（NIP準拠）:

```json
{
  "tags": [
    ["t", "/web/https://example.com/article/123"],
    ["r", "https://example.com/article/123"]
  ]
}
```

## 表示

投稿カードにはスーパーメンションが強調表示される。

```
┌────────────────────────────────────┐
│ @username · 2時間前                 │
│                                    │
│ @/manga/ハンチョウ                  │  ← 強調表示
│                                    │
│ 20巻の宮本さん、最高だった          │
│                                    │
│ ★★★                               │
└────────────────────────────────────┘
```

`@/` 部分が太字・黄色で表示され、クリックでフィルタリング可能。

確定済みのスーパーメンションにはQ番号バッジが表示される（例: `Q12345678`）。

### Q番号バッジのWikipediaリンク

Q番号バッジはクリック可能で、対応するWikipediaページを新しいタブで開く。

```
https://ja.wikipedia.org/wiki/Special:GoToLinkedPage/jawiki/{Q番号}
```

- サジェストポップアップ内のQ番号バッジ → クリックでWikipediaを開く
- 投稿本文内のQ番号バッジ → クリックでWikipediaを開く
- Wikipedia URLはOGPカード表示の対象外（プレビューカードは表示されない）

## サジェストUI

エディタ上部の `@/` ボタンをクリックすると、ポップアップでサジェストが表示される。

```
┌─────────────────────────────────────────┐
│ @/ [カテゴリを選択...]                    │
├─────────────────────────────────────────┤
│ [BookOpen] manga/    漫画                │
│ [Clapperboard] anime/ アニメ             │
│ [Gamepad2] game/    ゲーム               │
│ [Film] movie/       映画                 │
│ ...                                     │
└─────────────────────────────────────────┘
```

カテゴリ選択後、検索ワードを入力するとWikidataと履歴から候補を表示:

```
┌─────────────────────────────────────────────────────────┐
│ @/ [manga/] [ハンチョウ...]                              │
├─────────────────────────────────────────────────────────┤
│ [Check] ハンチョウ  1日外出録ハンチョウ [Q12345678]       │ ← Q確定済み
│ [Search] 班長       カイジの登場人物 [Q99999999]          │ ← Wikidata候補
│ [PenLine] ハンチョウ  新規作成                           │
└─────────────────────────────────────────────────────────┘
```

- 検索は部分一致（「無限城」で「鬼滅の刃 無限城編」がヒット）
- Backspaceでカテゴリ選択に戻る
- Escでポップアップを閉じる

### サジェストアイコン

| アイコン | 意味 |
|----------|------|
| Check | Q番号が確定済みの履歴 |
| Pin | Q番号未確定の履歴 |
| Search | Wikidata検索結果 |
| PenLine | 新規作成（カスタムパス） |

### Q番号の表示

- サジェスト候補にQ番号がバッジ表示される（例: `[Q12345678]`）
- ホバーでtooltipにも `Wikidata: Q12345678` と表示

### Q番号の訂正

誤ったQ番号が紐付いた場合:

1. 同じパスを入力（例: `@/manga/ハンチョウ`）
2. 履歴とWikidata候補が両方表示される
3. 正しいWikidata候補を選択
4. Q番号が上書きされる

※ 常にWikidata検索が実行されるため、いつでも訂正可能

## Wikidataマッピング

スーパーメンションはWikidata Q番号と紐付けて管理される。

```sql
CREATE TABLE super_mention_paths (
  path TEXT PRIMARY KEY,              -- "/manga/ハンチョウ"
  category TEXT NOT NULL,             -- "manga"
  wikidata_id TEXT,                   -- "Q123456789" (nullable)
  wikidata_label TEXT,                -- "1日外出録ハンチョウ"
  wikidata_description TEXT,          -- "日本の漫画作品"
  use_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**API エンドポイント:**

- `GET /api/wikidata/search?q=ハンチョウ&lang=ja` - Wikidata検索
- `GET /api/super-mention/suggest?prefix=/manga/&category=manga` - サジェスト取得
- `POST /api/super-mention/paths` - パス保存（使用時に自動）

## 将来の拡張

### 検索

特定の対象についての投稿を検索:

```
/posts?ref=/manga/ハンチョウ
```

### Q番号による正規化

同じ作品の表記ゆれを統一:
- `@/manga/ハンチョウ` → Q番号で正規化
- `@/manga/1日外出録ハンチョウ` → 同じQ番号

### カテゴリの追加

現在のカテゴリで不足する場合、`TOP_CATEGORIES` に追加可能:

```typescript
// apps/web/src/components/SuperMentionSuggest.tsx
const TOP_CATEGORIES = [
  { path: 'manga', label: '漫画', icon: BookOpen },
  // 新しいカテゴリを追加
  { path: 'food', label: '食べ物', icon: UtensilsCrossed },
]
```

## 設計思想

### はてブとの違い

- はてブ: URLのあるものだけ
- mypace: 万物（URLがなくてもOK）

### タグ乱立の解決

- 階層構造で整理
- サジェストで収束を促す
- 使用数が多いパスが上位に

### 万物の擬人化

`@` はメンション（呼びかけ）。作品や概念に対して「語りかける」ニュアンス。

```
@/thing/酸素

いつもありがとう
```
