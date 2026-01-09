# フィルタ機能 概要

mypaceのフィルタ機能の全体設計。

## 設計原則

### 1. 全フィルタはAPI側で処理

フロントエンドでフィルタすると、APIから50件取得後に除外するため、全件NGの場合0件表示になる問題がある。

**正しい設計**: 全てAPI側でフィルタし、フィルタ後の結果を返す。

**検索時の取得件数**: `q`（検索クエリ）や `tags`（OKタグ）がある場合、リレーから通常の20倍（最大1000件）を取得してからフィルタリングする。これにより、検索対象が少ない場合でも十分な結果を返せる。

### 2. 公開フィルタ vs 個人フィルタ

| 種類 | フィルタ | 保存場所 | URL表示 | 共有 |
|-----|---------|---------|--------|-----|
| 公開 | q（検索）, tags（OKタグ） | なし | ✓ | 可能 |
| 個人 | mute, ng, ngtags, hideNPC等 | localStorage | ✗ | 不可 |

**公開フィルタ**: ブラウザURLに含まれ、共有可能。
**個人フィルタ**: localStorageに保存、APIリクエスト時のみ送信。URLには含まれない（プライバシー保護）。

### 3. 共有URLは本人と他人で同じ見た目

ユーザーページ、タグページ、投稿ページは共有用途。個人設定フィルタを適用すると、本人と他人で見た目が異なってしまう。

本人が「この見た目でOK」と確認した状態が他人にも表示されることが重要。

---

## ページ別の挙動

### ホーム `/`

フィルタポップアップで設定（Save必要）+ TimelineSearch（URL即時反映）。

| フィルタ | 種類 | UI |
|---------|------|-----|
| q, tags | 公開 | TimelineSearch（タイムライン上部） |
| その他すべて | 個人 | FilterPanel（ポップアップ） |

**無限スクロール**: 検索時も「Load Older Posts」ボタンで過去を遡れる。1回のクリックで約1000件分の時間範囲を検索し、マッチした投稿を追加表示。

### ユーザーページ `/user/:npub`

フィルタポップアップは使用しない。TimelineSearchのみ。

```
例: /user/npub1xxx?tags=art+illustration&q=猫
→ このユーザーの #art かつ #illustration タグ付き、「猫」を含む投稿のみ表示
```

**用途**: ポートフォリオとして見せたい投稿を絞り込んだURLを共有

### 個別投稿 `/post/:id`

フィルタなし。常に表示。URL直指定なら何でも見れる。

### タグフィルタ

`/?tags=xxx` 形式でホームのタグフィルタを使用。ハッシュタグクリック時もこの形式にリダイレクト。

---

## APIパラメータ一覧

### タイムラインAPI `/api/timeline`

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `limit` | number | 50 | 取得件数（最大100） |
| `since` | number | 0 | この時刻以降 |
| `until` | number | 0 | この時刻以前 |
| `all` | `1` | - | #mypaceフィルタOFF |
| `kinds` | string | `1,30023,42000` | カンマ区切りkind |
| `lang` | string | - | 言語コード |
| `hideAds` | `0` | ON | 広告フィルタOFF |
| `hideNSFW` | `0` | ON | NSFWフィルタOFF |
| `hideNPC` | `1` | OFF | NPCフィルタON |
| `mute` | string | - | ミュートpubkey（カンマ区切り） |
| `ng` | string | - | NGワード（カンマ区切り） |
| `ngtags` | string | - | NGタグ（カンマ区切り） |
| `q` | string | - | 検索クエリ |
| `tags` | string | - | OKタグ（カンマ/+区切り、+はAND） |

### ユーザー投稿API `/api/user/:pubkey/events`

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|----------|------|
| `limit` | number | 50 | 取得件数（最大100） |
| `since` | number | 0 | この時刻以降 |
| `until` | number | 0 | この時刻以前 |
| `q` | string | - | 検索クエリ |
| `tags` | string | - | OKタグ（カンマ区切り） |

---

## フィルタ適用時の動作

FilterPanelで「Apply」または「Clear」を押すと、以下の処理が行われる：

1. 新しいフィルタ設定をlocalStorageに保存
2. `window.location.href = '/'` でホームにリダイレクト（フルリロード）

**重要**: SPAナビゲーション（`navigate()`）とフルリロード（`window.location.reload()`）を併用すると、競合状態が発生しリロードが無視されることがある。そのため、`window.location.href` を使用して確実にフルリロードを行う。

フルリロード後、`fetchTimeline()`が呼ばれ、localStorageから最新のフィルタ設定が読み込まれてAPIリクエストに適用される。

---

## 実装ファイル

| ファイル | 役割 |
|----------|------|
| `apps/api/src/filters/smart-filter.ts` | サーバーサイドフィルタロジック |
| `apps/api/src/routes/timeline.ts` | タイムラインAPI |
| `apps/api/src/routes/user-events.ts` | ユーザー投稿API |
| `apps/web/src/components/timeline/TimelineSearch.tsx` | 公開フィルタUI |
| `apps/web/src/components/filter/FilterPanel.tsx` | 個人フィルタUI（Apply/Clear時はフルリロード） |
| `apps/web/src/lib/api/api.ts` | APIクライアント（フィルタをlocalStorageから読み込み） |

---

## 関連ドキュメント

- [フィルター（ユーザーガイド）](../../user-guide/features/filters.md) - テキストフィルタ、kindフィルタ、プリセット
- [ミュート（ユーザーガイド）](../../user-guide/features/mute.md) - ミュートリスト
