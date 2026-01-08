# テキストフィルタ（OK/NGワード・タグ）

タイムラインの投稿をキーワードやタグでフィルタリングする機能。

## 概要

フィルタパネルで設定できるテキストベースのフィルタ:

| フィルタ | 動作                         | ロジック                   |
| -------- | ---------------------------- | -------------------------- |
| OKワード | 指定ワードを含む投稿のみ表示 | AND（すべてを含む）        |
| OKタグ   | 指定タグを含む投稿のみ表示   | AND（すべてを含む）        |
| NGワード | 指定ワードを含む投稿を非表示 | OR（いずれかを含めば除外） |
| NGタグ   | 指定タグを含む投稿を非表示   | OR（いずれかを含めば除外） |

## 入力形式

すべてのフィルタで **スペース区切り** で複数指定可能。

```
猫 犬 鳥
```

カンマや+などは普通の文字として扱われる（タグ名やキーワードに含められる）。

## OKワード

投稿本文に指定ワードを含むものだけを表示。

### 検索ロジック

- **AND検索**: すべてのワードを含む投稿のみ表示
- **部分一致**: 単語の途中でもマッチ（「漫画」で「少年漫画」「漫画家」もヒット）
- **大文字小文字**: 区別しない（case-insensitive）

### 例

```
入力: 猫 犬
結果: 「猫と犬が好き」は表示、「猫が好き」「犬を飼う」は非表示
```

## OKタグ

投稿本文に指定タグ（`#tag` または `@@path`）を含むものだけを表示。

### 検索ロジック

- **AND検索**: すべてのタグを含む投稿のみ表示
- ハッシュタグ `#tag` とスーパーメンション `@@path` の両方に対応
- スーパーメンション検索は `/path` 形式で指定

### 例

```
入力: mypace nostr      → #mypace AND #nostr の両方を含む投稿
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
入力: nsfw ad
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

| フィルタ         | URLパラメータ | 例              |
| ---------------- | ------------- | --------------- |
| OKワード（検索） | `q`           | `/?q=猫`        |
| OKタグ           | `tags`        | `/?tags=mypace` |

URL形式は`+`区切り（Google検索風）、特殊文字は自動エンコード。

```
# タイムラインで検索（スペース区切りで入力 → +区切りでURL保存）
入力: 猫 犬
URL: /?q=猫+犬

# タイムラインでタグフィルタ
入力: mypace nostr
URL: /?tags=mypace+nostr

# カンマを含むキーワード（自動エンコード）
入力: hello,world test
URL: /?q=hello%2Cworld+test

# ユーザーページで検索
入力: cat dog
URL: /user/npub1xxx?q=cat+dog

# ユーザーページでタグフィルタ
入力: art illustration
URL: /user/npub1xxx?tags=art+illustration
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
│ #  [Keywords...]                 ✓  │
│ #  [Tags...]                        │
│    [Clear] [Apply]              ────┘
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
- Applyボタンで適用（localStorageに保存）

## 実装ファイル

| ファイル                                              | 役割                              |
| ----------------------------------------------------- | --------------------------------- |
| `apps/api/src/filters/smart-filter.ts`                | サーバーサイドフィルタロジック    |
| `apps/api/src/routes/timeline.ts`                     | タイムラインAPI（フィルタ適用）   |
| `apps/api/src/routes/user-events.ts`                  | ユーザー投稿API（q/tags対応）     |
| `apps/web/src/components/timeline/TimelineSearch.tsx` | 公開フィルタUI（q/tags）          |
| `apps/web/src/components/filter/FilterFields.tsx`     | NG入力欄UI                        |
| `apps/web/src/components/filter/FilterPanel.tsx`      | フィルタパネル全体                |
| `apps/web/src/lib/api/api.ts`                         | APIクライアント（パラメータ送信） |
| `apps/web/src/lib/utils/content/content.ts`           | `contentHasTag` タグマッチング    |
| `apps/web/src/types/index.ts`                         | `SearchFilters` 型定義            |

## 関連ドキュメント

- [filter-overview.md](./filter-overview.md) - フィルタ機能の全体設計
- [kind-filter.md](./kind-filter.md) - SNS/Blogフィルタ
- [smart-filter.md](./smart-filter.md) - Ads/NSFWスマートフィルタ
- [filter-presets.md](./filter-presets.md) - プリセット保存
- [mute-list.md](./mute-list.md) - ミュートリスト
