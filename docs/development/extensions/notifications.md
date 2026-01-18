# 通知機能

自分の投稿への反応（ステラ・リプライ・リポスト）を通知する機能。
「マイペースに書く」と「反応への気づき」は別問題であり、相手がいる以上、反応には気づく責任がある。

## 設計思想

### 通知すべきイベント

| 種類 | 説明 |
|------|------|
| ステラ | 自分の投稿にステラが付いた |
| リプライ | 自分の投稿へのリプライ、または自分のリプライへのリプライ |
| リポスト | 自分の投稿がリポストされた |

### 通知しないもの

- 新着投稿の件数
- フォロー通知（機能自体がない）
- DM（機能自体がない）
- 「〇〇さんが投稿しました」系

### 追い立てないポリシー

- ❌ 「未読 37件」のような数字で追い立てない
- ✅ 新着があるかどうかだけ伝える（ベルアイコンの塗りつぶし）
- ✅ 各通知の既読/未読は視覚的に区別する（視認性のため）

## DBスキーマ

```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_pubkey TEXT NOT NULL,  -- 通知を受け取る人
  actor_pubkey TEXT NOT NULL,      -- アクションした人
  type TEXT NOT NULL,              -- 'stella' | 'reply' | 'repost'
  target_event_id TEXT NOT NULL,   -- 対象の投稿ID
  source_event_id TEXT,            -- リプライ/リポストのイベントID
  stella_count INTEGER,            -- ステラの場合のみ (1-10)
  created_at INTEGER NOT NULL,
  read_at INTEGER                  -- タップした日時（NULLなら未読）
);

CREATE INDEX idx_notifications_recipient ON notifications(recipient_pubkey);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_target ON notifications(target_event_id);
CREATE INDEX idx_notifications_type_target ON notifications(type, target_event_id, actor_pubkey);
CREATE INDEX idx_notifications_source ON notifications(source_event_id);
```

### フィールド説明

| フィールド | 説明 |
|-----------|------|
| recipient_pubkey | 通知を受け取る人（投稿者） |
| actor_pubkey | アクションした人（ステラ/リプライ/リポストした人） |
| type | 通知の種類 |
| target_event_id | 対象の投稿ID（ステラ/リプライ/リポスト先） |
| source_event_id | リプライやリポストのイベントID（ステラはNULL） |
| stella_count | ステラ数（1-10）、ステラ以外はNULL |
| created_at | 通知が発生した日時 |
| read_at | ユーザーがタップして投稿に遷移した日時（NULLなら未読） |

## 保存ルール

### 件数上限

- **1ユーザー50件**まで保存
- 50件を超えたら**古いものから削除**
- 新しい方の50件が常に保持される

### 削除ルール

通知挿入時に、同一ユーザーのレコードが50件を超えたら古いものを削除：

```sql
DELETE FROM notifications
WHERE recipient_pubkey = ?
  AND id NOT IN (
    SELECT id FROM notifications
    WHERE recipient_pubkey = ?
    ORDER BY created_at DESC
    LIMIT 50
  )
```

## 書き込みタイミング

イベント発行API（`POST /api/publish`）で自動記録：

| Kind | タグ | 処理 |
|------|------|------|
| Kind 7 + stellaタグ | e, p | ステラ通知を記録 |
| Kind 1（リプライ） | e, p | リプライ通知を記録 |
| Kind 6（リポスト） | e, p | リポスト通知を記録 |

### 判定ロジック

- **ステラ**: Kind 7 で `stella` タグがある
- **リプライ**: Kind 1 で `e` タグがある（返信先がある）
- **リポスト**: Kind 6

### ステラ通知の更新ルール

同一ユーザーが同一投稿にステラを上書きした場合：

| 変化 | 処理 |
|------|------|
| 増える（3→5） | 既存レコードの `stella_count` と `created_at` を更新 |
| 減る（5→3） | **何もしない**（通知しない） |
| 全削除（→0） | 通知レコードを削除 |

ステラが減る方向は通知する必要がない（ネガティブな通知は不要）。

### recipient_pubkey の取得

NIP-10/NIP-25 の規定により、すべてのイベントに `p` タグ（対象投稿者の pubkey）が含まれている。
リレーへの問い合わせ不要で recipient を特定できる。

```json
// ステラ（Kind 7）
{
  "kind": 7,
  "tags": [
    ["e", "<対象イベントID>"],
    ["p", "<対象投稿者pubkey>"],  // ← これが recipient_pubkey
    ["stella", "5"]
  ]
}

// リプライ（Kind 1）
{
  "kind": 1,
  "tags": [
    ["e", "<リプライ先イベントID>", "", "root"],
    ["p", "<リプライ先投稿者pubkey>"]  // ← これが recipient_pubkey
  ]
}

// リポスト（Kind 6）
{
  "kind": 6,
  "tags": [
    ["e", "<対象イベントID>"],
    ["p", "<対象投稿者pubkey>"]  // ← これが recipient_pubkey
  ]
}
```

MY PACE の実装（`apps/web/src/lib/nostr/events.ts`）でも `p` タグを正しく付与している。

## 既読管理

### read_at の更新タイミング

- ポップアップを開いただけでは既読にならない
- **通知をタップして投稿に遷移した時**に `read_at` を記録
- 誤タップでポップアップを閉じても、未読は未読のまま

### ベルアイコンの表示

```sql
SELECT COUNT(*) FROM notifications
WHERE recipient_pubkey = ? AND read_at IS NULL
```

- 結果 > 0 → **塗りつぶし**（フィルタアイコンと同様のスタイル）
- 結果 = 0 → **白/線のみ**

## 表示仕様

### 表示件数

- **最大20行**まで表示
- DB には50件保存するが、表示は集約後20行程度

### 集約ルール

同じ投稿への同種アクション（ステラ/リポスト）は1行にまとめる：

```
DB (5レコード):
├─ alice → 投稿X にステラ
├─ bob → 投稿X にステラ
├─ carol → 投稿X にステラ
├─ dave → 投稿X にリプライ
└─ eve → 投稿X にリポスト

表示 (3行):
├─ alice, bob, carol が投稿X にステラ
├─ dave が投稿X にリプライ
└─ eve が投稿X にリポスト
```

- **リプライは集約しない**
  - 各リプライの内容が異なるため、個別表示が必要
  - 集約すると「1つタップ → 全部既読」になり、他のリプライを見逃す可能性がある
- 「他N人」の N はDB内の件数のみ（正確でなくてもよい）

### 未読/既読の表示

- **未読**: 通常表示
- **既読**: 少し薄く表示（opacity など）

## UI配置

### ベルアイコンの位置

```
ヘッダー右側 (header-actions)
├─ filter-button-container  ← フィルタアイコン
├─ notification-button-container  ← ベルアイコン（新規追加）
└─ Settings  ← 歯車アイコン
```

### アイコン

Lucide React を使用：

| 用途 | アイコン名 |
|------|-----------|
| 通知ベル | `Bell` |
| ステラ | `Star` (fill) |
| リプライ | `MessageCircle` |
| リポスト | `Repeat2` |

### ポップアップ

フィルタポップアップと同様の UI パターン：

- ベルアイコンクリックでポップアップ表示
- 外側クリックで閉じる
- リスト形式で通知を表示

```
┌─────────────────────────────────────┐
│ 通知                                 │
├─────────────────────────────────────┤
│ ★ alice, bob 他3人がステラ          │
│    「今日の散歩で見つけた...」        │
│                            3分前    │
├─────────────────────────────────────┤
│ 💬 carol がリプライ                  │
│    「いいですね！」                   │
│                           15分前    │
├─────────────────────────────────────┤
│ 🔁 dave がリポスト                   │
│    「週末のカフェ巡り」               │
│                           1時間前   │
└─────────────────────────────────────┘
```

### タップ時の動作

通知をタップすると：

1. `read_at` を現在時刻で更新（API呼び出し）
2. 該当の投稿ページに遷移

## API仕様

### 通知一覧取得

```
GET /api/notifications?pubkey=<自分のpubkey>
```

レスポンス（集約済み）：

```json
{
  "notifications": [
    {
      "ids": [123, 124, 125],
      "type": "stella",
      "targetEventId": "abc123",
      "sourceEventId": null,
      "actors": [
        { "pubkey": "alice_pubkey", "stellaCount": 5 },
        { "pubkey": "bob_pubkey", "stellaCount": 3 }
      ],
      "createdAt": 1234567890,
      "readAt": null
    },
    {
      "ids": [126],
      "type": "reply",
      "targetEventId": "def456",
      "sourceEventId": "ghi789",
      "actors": [
        { "pubkey": "carol_pubkey" }
      ],
      "createdAt": 1234567800,
      "readAt": 1234567850
    }
  ],
  "hasUnread": true
}
```

### 未読チェック（ベルアイコン用）

```
GET /api/notifications/unread-count?pubkey=<自分のpubkey>
```

レスポンス：

```json
{
  "hasUnread": true
}
```

### 既読更新（複数）

集約された通知をタップした際、含まれる全IDをまとめて既読にする。

```
POST /api/notifications/read
Content-Type: application/json

{ "ids": [123, 124, 125] }
```

レスポンス：

```json
{
  "success": true
}
```

### 既読更新（単体）

```
POST /api/notifications/:id/read
```

レスポンス：

```json
{
  "success": true
}
```

## 今後の拡張（Phase 2）

### MY PACE外での通知

「マイペースに書く」と「反応への気づき」は別問題。
相手がいる以上、MY PACE を開いていなくても気づけるようにする。

| 方法 | 説明 |
|------|------|
| Web Push通知 | ブラウザの許可が必要、オプトイン式 |

- 設定でオプトイン（デフォルトはオフ）
- 「リプライのみ通知」「全部通知」など粒度選択

## 制限事項

- **MY PACE経由のみ**: 他のNostrクライアントからの反応は通知されない
- **自分への通知のみ**: 他人の投稿への反応は通知されない
