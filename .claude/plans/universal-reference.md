# ユニバーサルリファレンス（万物への言及）機能計画

> **「MYPACEをメタれるのはMYPACEだけ」**

## 概要

この世のあらゆるものに対してコメントできる標準フォーマット。
乱立するタグを整理し、階層構造とサジェスト機能を持たせる。

## 背景

### 既存の失敗例
- **セカイカメラ**: AR空間にコメント、時代が早すぎた
- **はてブ**: URLへのコメントは成功、でもURL限定
- **ブラウザサイドバー**: 周辺機器は流行らない（任天堂の哲学）

### はてブが強い理由
- ニュースやブログに一方的にコメントできる
- 対象は言い返せない（非対称性）
- 100人 vs 1人の徒党

### mypaceの目標
- **標準機能**として組み込む
- URLだけでなく、あらゆるものを対象に
- 階層化されたタグで整理
- インクリメンタルサジェスト

## 階層タグシステム

### 図書館分類を参考に

```
/               ← ルート（全て）
├── /web        ← Webサイト・URL
│   ├── /web/news
│   ├── /web/blog
│   └── /web/sns
├── /media      ← メディア作品
│   ├── /media/book
│   │   ├── /media/book/novel
│   │   └── /media/book/manga
│   ├── /media/movie
│   ├── /media/anime
│   ├── /media/game
│   └── /media/music
├── /place      ← 場所
│   ├── /place/country
│   ├── /place/city
│   └── /place/spot
├── /person     ← 人物
│   ├── /person/creator
│   ├── /person/artist
│   └── /person/historical
├── /product    ← 製品・サービス
│   ├── /product/tech
│   ├── /product/food
│   └── /product/fashion
├── /event      ← イベント
│   ├── /event/conference
│   ├── /event/festival
│   └── /event/sports
├── /concept    ← 概念・思想
│   ├── /concept/philosophy
│   ├── /concept/technology
│   └── /concept/culture
└── /misc       ← その他
```

### タグの構文

```
#/media/anime/evangelion
#/web/news/nhk.or.jp
#/place/japan/tokyo/shibuya
#/product/tech/apple/iphone
#/person/creator/miyazaki-hayao
```

## クラスとインスタンスの区別

### 概念

- **クラス（型）**: 一般的なカテゴリや作品全体
- **インスタンス（実体）**: 特定の回、特定のページ、特定のコメント

### 例

| クラス | インスタンス |
|--------|-------------|
| エヴァンゲリオン（作品） | 第26話「まごころを、君に」 |
| iPhone（製品ライン） | iPhone 15 Pro 256GB ブルー |
| 渋谷（地域） | ハチ公前の今日の写真 |
| はてブ（サービス） | 特定記事のコメントページ |

### インスタンスの指定方法

**方法1: 階層を深くする**
```
#/media/anime/evangelion/episode/26
#/product/apple/iphone/15-pro
#/place/japan/tokyo/shibuya/hachiko/2025-01-15
```

**方法2: URL参照（最も汎用的）**
```
@[https://example.com/specific/page]
```
→ 世界中のあらゆるインスタンスを一意に指定可能

**方法3: 既存の識別子を活用**
```
#/media/book/isbn:9784088725093      ← ISBN
#/media/music/isrc:JPPC01234567      ← ISRC（音楽）
#/place/geo:35.6812,139.7671          ← 座標
#/person/nostr:npub1xxx...            ← Nostr pubkey
#/web/archive:https://web.archive.org/...  ← アーカイブ
```

### 組み合わせ

クラスとインスタンスを同時に指定:
```
エヴァの第26話、やっと理解できた

#/media/anime/evangelion           ← クラス（作品全体）
@[https://netflix.com/watch/eva26] ← インスタンス（具体的なページ）
#mypace
```

### インスタンス指定の識別子一覧

| 種類 | 識別子 | 例 |
|------|--------|-----|
| Web | URL | `@[https://...]` |
| 書籍 | ISBN | `isbn:9784088725093` |
| 音楽 | ISRC | `isrc:JPPC01234567` |
| 動画 | YouTube ID | `youtube:dQw4w9WgXcQ` |
| 場所 | 座標 | `geo:35.6812,139.7671` |
| 日時 | ISO8601 | `date:2025-01-15T12:00:00Z` |
| Nostr | npub/note | `nostr:npub1...` |
| Twitter/X | ツイートID | `twitter:1234567890` |
| Amazon | ASIN | `asin:B0XXXXXXXX` |

### 特定のコメントへの言及

はてブの特定コメントを指定:
```
@[https://b.hatena.ne.jp/entry/s/example.com/article#comment-12345]

このコメント、完全に間違ってる

#/web/hatena/bookmark/comment
#mypace
```

フラグメント（#以降）でコメントIDを指定

## 投稿での使用

### 投稿例

```
エヴァンゲリオンの最終回、やっと理解できた気がする。

#/media/anime/evangelion
#mypace
```

```
渋谷のハチ公前、人多すぎ問題

#/place/japan/tokyo/shibuya/hachiko
#mypace
```

```
このニュース記事、ちょっと偏ってない？

#/web/news/https://example.com/article/12345
#mypace
```

## インクリメンタルサジェスト

### 入力UI

```
┌─ タグ入力 ─────────────────────────────┐
│                                        │
│ #/media/an                             │
│ ┌────────────────────────────────────┐ │
│ │ 📁 /media/anime                     │ │
│ │ 📁 /media/anime/evangelion          │ │
│ │ 📁 /media/anime/gundam              │ │
│ │ 📁 /media/anime/one-piece           │ │
│ │ 📁 /media/animation (映画)          │ │
│ └────────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
```

### サジェストのソース

1. **公式分類**: 基本的な階層構造
2. **コミュニティ追加**: ユーザーが追加したタグ
3. **使用頻度**: よく使われるタグを上位に
4. **最近使った**: 自分が最近使ったタグ

## 万物へのコメント検索

### 「○○についての投稿」を探す

```
┌─ 検索 ─────────────────────────────────┐
│                                        │
│ [#/media/anime/evangelion    ] [検索]  │
│                                        │
│ ─────────────────────────────────────  │
│                                        │
│ 📝 @userA · 2時間前                    │
│ 最終回、やっと理解できた...             │
│                                        │
│ 📝 @userB · 5時間前                    │
│ 庵野監督の新作情報きた！                │
│                                        │
│ 📝 @userC · 1日前                      │
│ 初めて見たけど難しい...                 │
│                                        │
└────────────────────────────────────────┘
```

### URL専用の検索

```
このURLについての投稿:
https://example.com/article/12345

→ #/web/https://example.com/article/12345 を検索
```

## データ構造

### Nostrタグ

```json
{
  "kind": 1,
  "content": "エヴァの最終回、やっと理解できた",
  "tags": [
    ["t", "mypace"],
    ["t", "/media/anime/evangelion"],
    ["r", "https://example.com"]  // URL参照の場合
  ]
}
```

### 階層タグのインデックス（D1）

```sql
CREATE TABLE tag_hierarchy (
  path TEXT PRIMARY KEY,        -- "/media/anime/evangelion"
  parent_path TEXT,             -- "/media/anime"
  name TEXT,                    -- "evangelion"
  display_name TEXT,            -- "エヴァンゲリオン"
  description TEXT,
  use_count INTEGER DEFAULT 0,
  created_at INTEGER,
  created_by TEXT               -- 追加したユーザー
);

CREATE INDEX idx_parent ON tag_hierarchy(parent_path);
CREATE INDEX idx_use_count ON tag_hierarchy(use_count DESC);
```

## 新規タグの追加

### ユーザーによる追加

```
┌─ 新しいタグを提案 ────────────────────┐
│                                       │
│ パス: /media/anime/                   │
│ 新規: [chainsaw-man     ]             │
│                                       │
│ 表示名: [チェンソーマン   ]            │
│                                       │
│ 説明:                                 │
│ [藤本タツキによる漫画・アニメ作品    ] │
│                                       │
│ [提案する]                            │
│                                       │
│ ※ 一定数の使用後に正式追加されます     │
│                                       │
└───────────────────────────────────────┘
```

### 承認フロー

1. ユーザーがタグを使用（暫定タグ）
2. 他のユーザーも使い始める
3. 閾値（例: 10件）を超えたら正式タグに
4. サジェストに表示される

## URLへの言及（はてブ的機能）

### 特殊構文

```
@[https://example.com/article]

これについて思うこと...
```

### 表示

```
┌─ 投稿 ─────────────────────────────────┐
│ @username · 2時間前                    │
│                                        │
│ ┌─ 参照先 ───────────────────────────┐ │
│ │ 📰 example.com                      │ │
│ │ 記事タイトルがここに表示            │ │
│ └────────────────────────────────────┘ │
│                                        │
│ これについて思うこと...                 │
│                                        │
│ ★★★                                  │
└────────────────────────────────────────┘
```

### URL別タイムライン

- 特定URLについての全投稿を表示
- はてブのコメント欄的な機能
- URLを入力 → そのURLへの言及一覧

## ブラウザ拡張（将来）

### 機能

- 閲覧中のページに対するmypace投稿を表示
- その場でコメント投稿
- 「このページについて○件の投稿」バッジ

### なぜ標準機能が先か

- 周辺機器（拡張機能）は流行らない
- まずmypace内で文化を作る
- 拡張機能は後から追加

## 競合との比較

| サービス | 対象 | 問題点 |
|----------|------|--------|
| はてブ | URL | URL限定 |
| Twitter | なんでも | タグが乱立、階層なし |
| セカイカメラ | AR空間 | 時代が早い |
| Hypothesis | Web注釈 | 拡張機能必須 |
| mypace | 万物 | 階層タグで整理 |

## 実装優先度

1. 基本階層構造の定義
2. 階層タグの入力UI
3. インクリメンタルサジェスト
4. タグ検索
5. URL参照機能
6. コミュニティタグ追加
7. ブラウザ拡張

## 哲学

### 「タグの民主化」

- 誰でもタグを提案できる
- よく使われるものが生き残る
- 階層構造で整理される
- 検索可能になる

### 「万物へのコメント権」

- ニュースに一方的にコメントできる
- 製品に一方的にレビューできる
- 概念に一方的に意見できる
- 分散型なので消されない

### 「非対称性の解消」

**はてブの非対称性:**
```
はてブユーザー 100人
       ↓ 一方的にコメント
ブログ作者 1人
       ↓ 言い返せない（場が違う）
```

**mypaceの目標:**
```
はてブユーザー 100人
       ↓ コメント
ブログ記事
       ↓ mypaceユーザーがはてブページ自体にコメント
はてブのコメントページ
       ↓ 徒党で言い返す
```

**具体的な使い方:**
```
@[https://b.hatena.ne.jp/entry/s/example.com/article]

はてブのコメント欄がひどい。
特に上から3番目のコメント、的外れすぎる。
みんなで反論しよう。

#/web/hatena/bookmark
#mypace
```

- はてブのコメントページ自体をURLとして参照
- mypaceユーザーが徒党でコメント
- 非対称性を逆転させる
- 「コメントへのコメント」のレイヤーを作る
