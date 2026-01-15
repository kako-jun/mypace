# フィルタ機能 概要

MY PACEのフィルタ機能の全体設計。

## 設計原則

### 1. 全フィルタはAPI側で処理

フロントエンドでフィルタすると、APIから50件取得後に除外するため、全件NGの場合0件表示になる問題がある。

**正しい設計**: 全てAPI側でフィルタし、フィルタ後の結果を返す。

**取得件数**: サーバーサイドフィルタ（hideAds, hideNSFW等）で除外される分を考慮し、リレーからは要求件数の4倍を取得。

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

フィルタポップアップの個人設定 + TimelineSearchの公開フィルタが両方適用される。

```
例: /user/npub1xxx?tags=art+illustration&q=猫
→ このユーザーの #art かつ #illustration タグ付き、「猫」を含む投稿のみ表示
```

**適用されるフィルタ**:
- 個人: mypace, lang, kinds, hideAds, hideNSFW, hideNPC, ng, ngtags
- 公開: q, tags
- **適用されない**: mute（ユーザーページは意図的に訪問しているため）

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
| `all` | `1` | - | #mypaceフィルタOFF |
| `kinds` | string | `1,30023,42000` | カンマ区切りkind |
| `lang` | string | - | 言語コード |
| `hideAds` | `0` | ON | 広告フィルタOFF |
| `hideNSFW` | `0` | ON | NSFWフィルタOFF |
| `hideNPC` | `1` | OFF | NPCフィルタON |
| `ng` | string | - | NGワード（+区切り） |
| `ngtags` | string | - | NGタグ（+区切り） |
| `q` | string | - | 検索クエリ |
| `tags` | string | - | OKタグ（+区切り、AND検索） |

> **注意**: タイムラインAPIと異なり、`mute`（ミュートリスト）は適用されない。

---

## フィルタ適用時の動作

FilterPanelで「Apply」または「Clear」を押すと、以下の処理が行われる：

1. 新しいフィルタ設定をlocalStorageに保存
2. `FILTER_APPLIED`カスタムイベントを発火
3. `useTimeline`フックがイベントをリッスンし、`loadTimeline()`を呼び出し
4. ポップアップを閉じる

**ページリロードなし**: イベント駆動でタイムラインのみを再取得するため、現在のURLを維持したままフィルタが即座に反映される。ポーリングのタイマーもリセットされる（`latestEventTime`が変更されるため）。

**現在のURLを維持**: ユーザーページ（`/user/npub1xxx`）やクエリパラメータ付きURL（`/?tags=art`）でフィルタを適用しても、同じURLのまま。

---

## 無限スクロールとリトライ

タイムライン下部の「Load Older Posts」ボタンで過去の投稿を読み込める。

### ボタンの表示

| 状態 | 表示テキスト |
|-----|------------|
| `hasMore=true` | Load Older Posts |
| `hasMore=false` | End of timeline (retry) |

**重要**: どちらの状態でもボタンは押せる。`hasMore`は単なるラベルの切り替えであり、過去の読み込みを制限するものではない。

### リトライの意義

APIから0件返ってきても、以下の理由でリトライの機会を残す：
- リレーの一時的な障害
- ネットワーク接続の問題
- タイミングによるデータ欠損

「End of timeline」はあくまで「今のところ終端のようだ」という表示であり、再度ボタンを押せば同じ時間範囲を再検索できる。

### hasMoreの判定ロジック

`hasMore`は「Load Older Posts」と「End of timeline (retry)」の表示切り替えに使用。判定ロジック：

1. **初回ロード時**: `hasMore = true`（まだ過去を探っていないため）
2. **過去読み込み後**: `hasMore = (最古の投稿が変化したか)`
   - 取得した投稿の最古時刻が、既知の最古時刻より古ければ `true`
   - 変化しなければ `false`（End表示、ただしリトライ可能）

この判定により、マジックナンバー（例: 50件）に依存しないクリーンな実装となっている。

---

## スマートフィルタの詳細

`filterBySmartFilters` が検出する内容：

### 広告フィルタ (hideAds)

| チェック対象 | 説明 |
|-------------|------|
| 構造化tタグ | `bitcoin`, `crypto`, `nft`, `airdrop`, `giveaway`, `ad`, `pr`, `promotion` |
| 本文中の#tag | 上記タグが `#bitcoin` のように本文に含まれる場合も検出 |
| キーワード | `airdrop`, `giveaway`, `free btc`, `free bitcoin` |
| URL数 | 11個以上のURLを含む投稿 |

### NSFWフィルタ (hideNSFW)

| チェック対象 | 説明 |
|-------------|------|
| 構造化tタグ | `nsfw`, `r18`, `porn`, `hentai`, `content-warning` |
| 本文中の#tag | 上記タグが `#nsfw` のように本文に含まれる場合も検出 |
| .onionリンク | ダークウェブへのリンク（`.onion`ドメイン）を含む投稿 |

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
