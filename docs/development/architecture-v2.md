# アーキテクチャ v2: ブラウザ直接接続

## 背景

### 現状の問題
- Cloudflare WorkersからNostrリレーへのWebSocket接続で503エラー（Worker exceeded resource limits）
- APIでキャッシュを持つとmypaceタグ付き投稿がNostr全体に埋もれる
- スケールしない

### 解決策
ブラウザが直接Nostrリレーに接続する。APIはキャッシュを持たない。

---

## 新アーキテクチャ

### データフロー

```
[ブラウザ]
    │
    ├─── 直接接続 ───> [Nostrリレー]
    │                    - タイムライン取得
    │                    - ユーザー投稿取得
    │                    - プロフィール取得
    │                    - 投稿（publish）
    │
    └─── API呼び出し ──> [Cloudflare Workers]
                          - X埋め込み取得
                          - ステラ記録（D1）
                          - インプレッション記録（D1）
                          - OGP取得
                          - Wikidata取得
```

### ブラウザ側の責務

1. **タイムライン取得**
   - nostr-toolsでリレーに直接接続
   - フィルタリング（mypace/all、言語、NG等）はブラウザ側で実行

2. **ユーザー投稿取得**
   - ユーザーページの投稿一覧

3. **プロフィール取得**
   - kind:0イベントを直接取得

4. **投稿（publish）**
   - 署名はブラウザ（NIP-07 or 秘密鍵）
   - リレーへ直接送信

### API側の責務（補助のみ）

1. **X埋め込み取得** (`/api/tweet/:id`)
   - Twitter/X APIへのプロキシ
   - ブラウザからは直接取得できないため

2. **ステラ記録**
   - D1にステラ情報を記録
   - ステラ集計はAPIで管理
   - **0→1**：ブラウザがkind:7をリレーに送信 + APIにステラ記録
   - **1→2, 2→3, ...10**：APIにステラ記録を更新するだけ（kind:7は送信しない）
   - **削除（1→0）**：ブラウザがkind:5をリレーに送信 + APIからステラ記録を削除

3. **インプレッション記録** (`/api/views`)
   - 表示回数の記録

4. **OGP取得** (`/api/ogp`)
   - URLのOGP情報取得
   - CORSの問題があるため

5. **Wikidata取得** (`/api/wikidata`)
   - super-mention用

---

## 削除するAPI

- `/api/timeline` - ブラウザが直接取得
- `/api/user/:pubkey/events` - ブラウザが直接取得
- `/api/events/enrich` - 大部分が不要に（メタデータはブラウザで取得）

## 残すAPI

- `/api/tweet/:id` - X埋め込み
- `/api/ogp` - OGP取得
- `/api/wikidata` - Wikidata
- `/api/views` - インプレッション
- `/api/publish` - ステラ記録のみ（投稿自体はブラウザから直接）
- `/api/serial` - 通し番号
- `/api/sticker` - ステッカー
- `/api/pins` - ピン留め
- `/api/uploads` - アップロード

---

## D1の役割変更

### 削除するテーブル（キャッシュ）
- `events` - タイムラインキャッシュ → 不要
- `profiles` - プロフィールキャッシュ → 不要

### 残すテーブル（MY PACE独自データ）
- `user_stella` - ステラ記録（Nostrにはない独自機能）
- `user_serial` - 通し番号（MY PACE独自）
- `event_views` - 閲覧記録（誰がどのイベントを見たか）
- `ogp_cache` - OGPキャッシュ（APIプロキシ用、CORSの関係で必要）
- `super_mention_paths` - スーパーメンション履歴（Wikidata連携用）
- `sticker_history` - ステッカー履歴
- `user_pins` - ピン留め投稿
- `upload_history` - アップロード履歴

---

## 実装方針

### 移植の考え方
- API側の関数をほぼそのままブラウザ側に移植
- **関数名も同じにする**（例：`fetchTimeline`, `fetchEventsEnrich`）
- 配列で一気に取得する動作も維持
- enrichの情報がすべて揃うまで描画しない動作も維持
- 動作の違いを最小限にし、置き換えをスムーズに

### ブラウザ側に移植する関数
```
/api/timeline          → fetchTimeline()
/api/user/:pubkey/events → fetchUserEvents()
/api/events/enrich     → fetchEventsEnrich()
  - metadata (reactions, replies, reposts)
  - profiles
  - superMentions
```

---

## 実装計画

### Phase 1: フロントエンド変更
1. nostr-toolsをブラウザで使用する設定
2. `lib/nostr/` に移植関数を作成（API側と同じ関数名）
3. タイムライン取得をAPI→リレー直接に変更
4. enrich取得をAPI→リレー直接に変更
5. プロフィール取得をAPI→リレー直接に変更
6. ユーザー投稿取得をAPI→リレー直接に変更

### Phase 2: API簡素化
1. 不要なルート削除（timeline, user-events, events/enrich）
2. 不要なキャッシュ関連コード削除
3. 不要なテーブル削除（events, profiles）

### Phase 3: 動作確認・最適化
1. リレー接続のエラーハンドリング
2. 複数リレーへのフォールバック
3. パフォーマンス最適化

---

## メリット

- 503エラー問題が根本解決
- APIの負荷激減
- スケーラブル（ユーザー数に依存しない）
- リアルタイム性向上
- Nostrの分散型思想に合致
- コードがシンプルになる

## デメリット

- フロントエンドの大幅書き換え
- リレー接続エラーのハンドリングがブラウザ側に移る
- 一部のリレーがブロックしているユーザーへの対応

---

## 注意点

- ステラの集計はAPIで管理する必要がある（ブラウザだけでは集計できない）
- インプレッションもAPI管理
- X埋め込みはCORSの関係でAPI経由必須
