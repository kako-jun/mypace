# ユーザー通し番号

mypaceへの参加順に通し番号を付与し、感謝を表示する機能。

## 概要

初めて#mypaceタグ付き投稿をしたユーザーに、参加順の番号を付与する。
プロフィールページで「Thanks #N」と表示し、参加への感謝を示す。

## コンセプト

- 番号は「ID」ではなく「感謝」の表現
- 早期参加者も後発参加者も等しく感謝
- シンプルな表示（装飾なし）

## 番号の付与

### 付与タイミング

ユーザーが初めて#mypaceタグ付きkind:1投稿をした時点で番号確定。

- Kind 0（プロフィール）ではなく
- Kind 1（投稿）+ #mypaceタグが条件
- 初投稿のcreated_atで順位決定

### 自動登録

投稿時（/api/publish）に自動でチェック・登録される。

## データ構造

### D1テーブル

```sql
CREATE TABLE user_serial (
  pubkey TEXT PRIMARY KEY,
  serial_number INTEGER UNIQUE NOT NULL,
  first_post_id TEXT NOT NULL,
  first_post_at INTEGER NOT NULL,
  visible INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);
```

- `serial_number`: 参加順の番号（1から連番）
- `first_post_id`: 初回#mypace投稿のイベントID
- `first_post_at`: 初回投稿のタイムスタンプ
- `visible`: 表示フラグ（オプトアウト用）

## UI

### プロフィール表示

ユーザー名の横に「Thanks #N」と表示。

```
┌─ プロフィール ─────────────────┐
│                                │
│  [アバター]  @username         │
│             Thanks #42         │
│                                │
└────────────────────────────────┘
```

### オプトアウト

表示を非公開にすることも可能（visible=0）。
番号自体は保持され、再表示も可能。

## API

### GET /api/serial/:pubkey

ユーザーの通し番号を取得。

**レスポンス:**
```json
{
  "serial": 42,
  "firstPostAt": 1234567890,
  "visible": true
}
```

番号がない場合:
```json
{
  "serial": null
}
```

### GET /api/serial

ユーザー一覧（番号順）。

**クエリパラメータ:**
- `limit`: 取得件数（デフォルト100）
- `offset`: オフセット
- `visible`: falseで非公開ユーザーも含む

**レスポンス:**
```json
{
  "users": [
    { "pubkey": "...", "serial": 1, "firstPostAt": 1234567890, "visible": true },
    ...
  ],
  "total": 100
}
```

### POST /api/serial/visibility

表示設定を変更。

**リクエスト:**
```json
{
  "pubkey": "hex_pubkey",
  "visible": false
}
```

### POST /api/serial/init

既存ユーザーの初期化（管理用）。
eventsテーブルから#mypace投稿を持つユーザーを抽出し、初投稿順に番号を付与。

## 使用箇所

- **プロフィールページ**: UserView -> UserProfile -> SerialBadge

## 他クライアントとの互換性

通し番号情報はmypaceのD1データベースに保存されるため、他のNostrクライアントでは認識されない。
mypaceのプロフィールページでのみ表示される。
