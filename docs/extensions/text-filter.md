# テキストフィルタ（OK/NGワード・タグ）

タイムラインの投稿をキーワードやタグでフィルタリングする機能。

## 概要

フィルタパネルで設定できるテキストベースのフィルタ:

| フィルタ | 動作 | ロジック |
|----------|------|----------|
| OKワード | 指定ワードを含む投稿のみ表示 | OR（いずれかを含む） |
| OKタグ | 指定タグを含む投稿のみ表示 | OR または AND |
| NGワード | 指定ワードを含む投稿を非表示 | OR（いずれかを含めば除外） |
| NGタグ | 指定タグを含む投稿を非表示 | OR（いずれかを含めば除外） |

## 入力形式

すべてのフィルタで **スペース** または **カンマ** 区切りで複数指定可能。

```
猫 犬 鳥
猫, 犬, 鳥
猫,犬,鳥
```

上記はすべて同じ意味（3つのキーワード指定）。

## OKワード

投稿本文に指定ワードを含むものだけを表示。

### 検索ロジック

- **OR検索**: いずれかのワードを含めば表示
- **部分一致**: 単語の途中でもマッチ（「漫画」で「少年漫画」「漫画家」もヒット）
- **大文字小文字**: 区別しない（case-insensitive）

### 例

```
入力: 猫 犬
結果: 「猫が好き」「犬と散歩」どちらも表示、「鳥を飼う」は非表示
```

## OKタグ

投稿本文に指定タグ（`#tag` または `@@path`）を含むものだけを表示。

### 検索ロジック

- **区切り文字で動作が変わる**:
  - スペース/カンマ区切り → **OR検索**
  - `+` 区切り → **AND検索**
- ハッシュタグ `#tag` とスーパーメンション `@@path` の両方に対応
- スーパーメンション検索は `/path` 形式で指定

### 例

```
入力: mypace, nostr     → #mypace OR #nostr
入力: mypace+nostr      → #mypace AND #nostr
入力: /ハンチョウ       → @@ハンチョウ を含む投稿
```

## NGワード

投稿本文に指定ワードを含むものを非表示。

### 検索ロジック

- **OR除外**: いずれかのワードを含めば非表示
- **部分一致**: 単語の途中でもマッチ
- **大文字小文字**: 区別しない

### 例

```
入力: 広告 PR
結果: 「広告です」「PR案件」を含む投稿は非表示
```

## NGタグ

投稿本文に指定タグを含むものを非表示。

### 検索ロジック

- **OR除外**: いずれかのタグを含めば非表示
- ハッシュタグとスーパーメンション両対応

### 例

```
入力: nsfw, ad
結果: #nsfw または #ad を含む投稿は非表示
```

## フィルタの優先順位

全フィルタがAPIサーバー側で処理される。処理順序:

1. **基本フィルタ**（mypace、SNS/Blog、Ads/NSFW、言語、hideNPC）
2. **ミュートリスト** → ミュートユーザーの投稿を除外
3. **NGタグ** → 指定タグを含むものを除外
4. **NGワード** → 指定ワードを含むものを除外

OKタグ/OKワード（`q`, `tags`）は公開フィルタとしてURL形式で指定可能。

## 保存方法

フィルタには2種類ある:

### 公開フィルタ（URL形式、共有可能）

| フィルタ | URLパラメータ | 例 |
|---------|-------------|-----|
| OKワード（検索） | `q` | `/?q=猫` |
| OKタグ | `tags` | `/?tags=mypace,nostr` または `/?tags=mypace+nostr`（AND） |

```
# タイムラインで検索
/?q=検索ワード

# タイムラインでタグフィルタ
/?tags=mypace,nostr      # OR検索
/?tags=mypace+nostr      # AND検索

# ユーザーページで検索
/user/npub1xxx?q=検索ワード

# ユーザーページでタグフィルタ
/user/npub1xxx?tags=art+illustration
```

### 個人フィルタ（localStorage、URLに含まない）

以下のフィルタは **localStorage** に保存され、APIリクエスト時にパラメータとして送信。
ブラウザURLには含まれない（共有URLに個人設定が漏れない）。

- NGワード、NGタグ
- ミュートリスト
- SNS/Blog、mypace、言語
- hideAds、hideNSFW、hideNPC

## UI

### 公開フィルタ（TimelineSearch）

タイムライン上部に常時表示される検索UI。ホームページとユーザーページで共通。

```
┌─────────────────────────────────────┐
│ 🔍 [Search...]                   ✓  │
│ #  [Tags (space or + separated)]    │
└─────────────────────────────────────┘
```

- Enter または ✓ ボタンで検索適用
- アクティブなフィルタはチップで表示（× で個別クリア）
- 「Clear all」で全クリア
- URLに即時反映、共有可能

### 個人フィルタ（FilterPanel）

フィルタポップアップ内のNGフィルタ（ホーム専用）:

```
┌─────────────────────────────────────┐
│ NG                                  │
│   🚫 [キーワード...]                │
│   #  [タグ...]                      │
└─────────────────────────────────────┘
```

- 各入力欄の右に×ボタン（クリアボタン）
- Saveボタンで適用（localStorageに保存）

## 実装ファイル

| ファイル | 役割 |
|----------|------|
| `apps/api/src/filters/smart-filter.ts` | サーバーサイドフィルタロジック |
| `apps/api/src/routes/timeline.ts` | タイムラインAPI（フィルタ適用） |
| `apps/api/src/routes/user-events.ts` | ユーザー投稿API（q/tags対応） |
| `apps/web/src/components/timeline/TimelineSearch.tsx` | 公開フィルタUI（q/tags） |
| `apps/web/src/components/filter/FilterFields.tsx` | NG入力欄UI |
| `apps/web/src/components/filter/FilterPanel.tsx` | フィルタパネル全体 |
| `apps/web/src/lib/api/api.ts` | APIクライアント（パラメータ送信） |
| `apps/web/src/lib/utils/content/content.ts` | `contentHasTag` タグマッチング |
| `apps/web/src/types/index.ts` | `SearchFilters` 型定義 |

## 関連ドキュメント

- [kind-filter.md](./kind-filter.md) - SNS/Blogフィルタ
- [smart-filter.md](./smart-filter.md) - Ads/NSFWスマートフィルタ
- [filter-presets.md](./filter-presets.md) - プリセット保存
- [mute-list.md](./mute-list.md) - ミュートリスト
