# 閲覧数（View Count）

投稿の閲覧数を記録・表示する機能。
MY PACE独自のD1データベースでトラッキングし、2種類の指標を提供する。

## 背景

- Nostrプロトコルには閲覧数を記録する標準的な仕組みがない
- 分散型プロトコルの性質上、中央集権的なトラッキングが必要
- MY PACE経由の閲覧のみをカウント（他クライアントからの閲覧は含まない）

## 2種類の指標

| 指標 | 名称 | カウント条件 | 用途 |
|------|------|-------------|------|
| **インプレッション** | impression | タイムラインに表示された | 露出度 |
| **詳細閲覧数** | detail | 詳細ページを開いた | 実際の関心度 |

## カウントルール

- **対象投稿**: `#mypace`タグが付いた投稿のみ（MY PACE投稿のみ）
- **ユニークカウント**: 同一ユーザー（pubkey）は各指標につき1回のみカウント
- **全ユーザー対象**: 初アクセス時にpubkeyが生成されるため、未ログインの概念なし
- **MY PACE限定**: MY PACEアプリ経由の閲覧のみ

## カウント対象シナリオ

| シナリオ | インプレッション | 詳細 |
|---------|:----------------:|:----:|
| タイムラインに投稿カードとして表示 | ✅ | - |
| タイムラインでカードクリック→ポップアップ展開 | ✅（読込時） | ✅ |
| 投稿URLを直接入力して開く | - | ✅ |
| リプライとしてタイムラインに表示 | - | - |
| 投稿詳細ページでリプライカードとして表示 | - | - |
| 投稿詳細ページでリプライ元カードとして表示 | - | - |

**補足:**
- タイムラインから投稿詳細を開くと、インプレッション（タイムライン読込時）と詳細（ポップアップ表示時）の両方がカウントされる
- リプライや引用元として表示された投稿は、いずれのカウントにも含まれない
- `PostModal`（ポップアップ）も`PostView`コンポーネントを使用するため、詳細としてカウントされる

## DBスキーマ

```sql
CREATE TABLE IF NOT EXISTS event_views (
  event_id TEXT NOT NULL,
  author_pubkey TEXT NOT NULL,    -- 投稿者のpubkey（ユーザー累計用）
  viewer_pubkey TEXT NOT NULL,
  view_type TEXT NOT NULL,        -- 'impression' or 'detail'
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, viewer_pubkey, view_type)
);

CREATE INDEX IF NOT EXISTS idx_event_views_event ON event_views(event_id);
CREATE INDEX IF NOT EXISTS idx_event_views_author ON event_views(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_event_views_viewer ON event_views(viewer_pubkey);
CREATE INDEX IF NOT EXISTS idx_event_views_type ON event_views(view_type);
```

`author_pubkey`カラムは、ユーザーページでの累計閲覧数表示に使用する。
投稿単位のカウントでは`event_id`でグループ化し、ユーザー単位のカウントでは`author_pubkey`でグループ化する。

## API仕様

### 閲覧一括記録

タイムライン表示時・詳細ページ閲覧時に、複数の投稿を一度に記録する。

```
POST /api/views/impressions
```

リクエストボディ:

```json
{
  "events": [
    { "eventId": "event1", "authorPubkey": "pubkey1" },
    { "eventId": "event2", "authorPubkey": "pubkey2" },
    { "eventId": "event3", "authorPubkey": "pubkey3" }
  ],
  "type": "impression",
  "viewerPubkey": "hex_pubkey"
}
```

- `type`: `"impression"` または `"detail"`
- `events`: 最大100件まで

レスポンス:

```json
{
  "success": true,
  "recorded": 3
}
```

### ユーザー累計閲覧数を取得

ユーザー統計APIに含まれる（`GET /api/user/:pubkey/stats`）。

レスポンスの `viewsCount` フィールド:

```json
{
  "viewsCount": {
    "details": 45,
    "impressions": 123
  }
}
```

ユーザーページでは `詳細 / インプレッション` 形式（例: `45 / 123`）で表示する。

## UI表示

### 表示形式

```
2025-01-13 · [BarChart2] 25 / 150 · NPC
             ↑アイコン   ↑詳細 ↑インプレ
```

- タイムスタンプの後ろに ` · ` 区切りで表示
- 詳細閲覧数を左、インプレッション数を右として ` / ` で区切る
- 「150人に表示されて、25人が詳細を開いた」という意味
- 両方0の場合も `0 / 0` と表示

### 表示場所

投稿ヘッダー内、タイムスタンプの直後:
- タイムラインの各投稿カード（`PostHeader`コンポーネント）
- 投稿詳細ページ（`PostView`）

### アイコン

棒グラフアイコン（`BarChart2`、12px）を使用。絵文字は使わない。

## 実装詳細

### クライアント側

バッチAPIを使用して複数投稿の閲覧を一括記録する:

```typescript
// タイムラインに投稿が表示されたとき（バッチ記録）
async function recordImpressions(
  events: Array<{ eventId: string; authorPubkey: string }>,
  viewerPubkey: string
) {
  await fetch('/api/views/impressions', {
    method: 'POST',
    body: JSON.stringify({
      events,
      type: 'impression',
      viewerPubkey,
    }),
  })
}

// 詳細ページを開いたとき（1件でもバッチAPIを使用）
async function recordDetailView(eventId: string, authorPubkey: string, viewerPubkey: string) {
  await fetch('/api/views/impressions', {
    method: 'POST',
    body: JSON.stringify({
      events: [{ eventId, authorPubkey }],
      type: 'detail',
      viewerPubkey,
    }),
  })
}
```

### サーバー側

```typescript
// 一括閲覧記録（UPSERT、バッチ処理）
views.post('/impressions', async (c) => {
  const { events, type, viewerPubkey } = await c.req.json()

  const limitedEvents = events.slice(0, 100)
  const now = getCurrentTimestamp()

  const stmt = c.env.DB.prepare(
    `INSERT INTO event_views (event_id, author_pubkey, viewer_pubkey, view_type, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (event_id, viewer_pubkey, view_type) DO NOTHING`
  )

  const batch = limitedEvents.map((e) =>
    stmt.bind(e.eventId, e.authorPubkey, viewerPubkey, type, now)
  )

  await c.env.DB.batch(batch)

  return c.json({ success: true, recorded: limitedEvents.length })
})
```

## パフォーマンス考慮

### バッチ取得

タイムライン表示時は複数投稿の閲覧数を一括取得し、N+1問題を回避。

### 記録の非同期化

閲覧記録は`fire-and-forget`で非同期実行し、UI応答性に影響を与えない。

### インデックス

`event_id`と`view_type`にインデックスを設定し、集計クエリを高速化。

## ユーザープロフィールでの表示

ユーザーページでは、そのユーザーの累計閲覧数を表示する。

### 表示形式

```
[BarChart2] 45 / 123
            ↑詳細 ↑インプレ
```

- 棒グラフアイコン（BarChart2）の後に `詳細 / インプレッション` 形式で表示
- 「123回表示されて、45回詳細ページが開かれた」という意味
- `UserProfile`コンポーネントの`user-stats`内に表示

## 関連機能

### ユーザーの総獲得ステラ数

ユーザーページにこれまで獲得した総ステラ数を表示する機能も同様にD1で集計する。
詳細は [stella.md](./stella.md) を参照。

## 制限事項

- MY PACE経由の閲覧のみカウント（他のNostrクライアントからの閲覧は含まない）
- 「表示された」と「読まれた」は厳密には異なる（短い投稿は区別不可）
- ユニークカウントのため、同じユーザーが何度見ても1回としてカウント

## 他のNostrクライアントとの関係

- 閲覧数はMY PACE独自のD1データベースに保存
- Nostrイベントとしては記録されない
- 他のクライアントからは閲覧数を参照できない
