# stella（マルチスター反応）

1つの投稿に対して、1人のユーザーが最大10個のステラを付けられる機能。
NIP-25（リアクション）を拡張し、ステラ数をタグで管理する。

## 背景

- 通常のNostrリアクション（Kind 7）は1投稿1リアクション
- 「いいね」より強い気持ちを表現したい場合がある
- ステラ数で反応の強さを段階的に表現

## タグ形式

```json
["stella", "<ステラ数>"]
```

ステラ数は1〜10の整数。

## イベント形式

Kind 7（NIP-25リアクション）に`stella`タグを追加:

```json
{
  "kind": 7,
  "content": "+",
  "tags": [
    ["e", "<対象イベントID>"],
    ["p", "<対象イベント作者のpubkey>"],
    ["stella", "5"]
  ]
}
```

## 動作仕様

### ステラ追加

1. ユーザーがステラボタンをクリック
2. デバウンス処理（500ms）で連打を集約
3. 新しいリアクションイベントを作成（累積ステラ数を含む）
4. 古いリアクションイベントを削除（Kind 5）

### ステラ上限

- 1ユーザー1投稿あたり最大**10ステラ**
- 上限到達後はボタンが非活性化

### ステラ削除（全削除）

- 長押しまたはカウントクリックで削除確認
- 削除するとそのユーザーの全ステラが消える（0に戻る）

## API仕様

### リアクション取得

```
GET /api/reactions/:eventId?pubkey=<自分のpubkey>
```

レスポンス:

```json
{
  "count": 25,           // 全ユーザーの合計ステラ数
  "myReaction": true,    // 自分がステラを付けたか
  "myStella": 5,         // 自分のステラ数
  "myReactionId": "...", // 自分のリアクションイベントID
  "reactors": [          // リアクター一覧（新しい順）
    {
      "pubkey": "...",
      "stella": 5,
      "reactionId": "...",
      "createdAt": 1234567890
    }
  ]
}
```

### 集計ロジック

1. 対象イベントへのKind 7を全取得
2. pubkeyでグループ化し、最新のリアクションのみ採用
3. 各ユーザーの`stella`タグからステラ数を取得
4. タグがない場合はデフォルト1として扱う（後方互換性）

## UI表示

### ステラ数表示

```
★ 25
```

合計ステラ数を表示。クリックでリアクター一覧ポップアップ。

### リアクター一覧

```
┌─────────────────────────┐
│ ユーザーA    ★★★★★ (5) │
│ ユーザーB    ★★★ (3)   │
│ ユーザーC    ★ (1)     │
└─────────────────────────┘
```

### 自分のステラ

自分が付けたステラ数に応じてボタンの状態が変化:
- 0: 空のスター
- 1-9: 塗りつぶしスター（追加可能）
- 10: 塗りつぶしスター（上限到達）

## 実装詳細

### クライアント側

```typescript
// 定数
export const MAX_STELLA_PER_USER = 10
export const STELLA_TAG = 'stella'

// リアクション作成
export async function createReactionEvent(
  targetEvent: Event,
  content: string = '+',
  stellaCount: number = 1
): Promise<Event> {
  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags: [
      ['e', targetEvent.id],
      ['p', targetEvent.pubkey],
      [STELLA_TAG, String(Math.min(stellaCount, MAX_STELLA_PER_USER))],
    ],
    content,
  }
  // 署名...
}
```

### サーバー側

```typescript
function getStellaCount(event: Event): number {
  const stellaTag = event.tags.find((t) => t[0] === 'stella')
  if (stellaTag && stellaTag[1]) {
    const count = parseInt(stellaTag[1], 10)
    return isNaN(count) ? 1 : count
  }
  return 1 // デフォルト（後方互換性）
}
```

## 他のNostrクライアントでの表示

- `stella`タグは無視される
- Kind 7リアクションとして認識される
- 1リアクションとしてカウントされる（ステラ数は無視）

## 注意点

- ステラ追加のたびに新しいリアクションイベントを作成し、古いものを削除
- 削除が失敗しても新しいリアクションが有効（最新のみ採用）
- デバウンス処理により、連打時のネットワーク負荷を軽減

## ユーザー累計ステラ数

ユーザーページに、そのユーザーが獲得した累計ステラ数を表示する機能。

### 背景

- Nostrリレーには累計を保存する仕組みがない
- 毎回全リアクションを集計するのは非効率
- D1データベースにキャッシュして高速表示

### DBスキーマ

```sql
CREATE TABLE IF NOT EXISTS user_stella (
  event_id TEXT NOT NULL,           -- ステラを受けた投稿ID
  author_pubkey TEXT NOT NULL,      -- 投稿者（集計対象）
  reactor_pubkey TEXT NOT NULL,     -- ステラを付けた人
  stella_count INTEGER NOT NULL,    -- ステラ数 (1-10)
  reaction_id TEXT,                 -- リアクションイベントID（削除用）
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, reactor_pubkey)
);

CREATE INDEX IF NOT EXISTS idx_user_stella_author ON user_stella(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_stella_reaction ON user_stella(reaction_id);
```

### 記録タイミング

イベント発行API（`POST /api/publish`）で自動記録:

1. **Kind 7 + stellaタグ**: user_stellaにUPSERT（reaction_idも保存）
2. **Kind 5（リアクション削除）**: reaction_idで該当レコードをDELETE
3. **Kind 5（投稿削除）**: event_idでその投稿への全ステラをDELETE

### 操作パターンと処理

| 操作 | DB処理 |
|------|--------|
| ステラ追加 (0→1, 1→2, ...) | UPSERT（stellaCountを更新） |
| ステラ全削除 (→0) | DELETE（レコード削除） |
| 投稿削除 | DELETE WHERE event_id = ?（全ステラ削除） |

### API仕様

```
GET /api/users/:pubkey/stella
```

レスポンス:

```json
{
  "total": 1234
}
```

### UI表示

ユーザーページのプロフィールカード内に表示:

```
123 posts ★ 456
          ↑累計ステラ
```

- 0でも表示（ローディング中は「...」）

### 制限事項

- **MY PACE経由のみ**: 他のNostrクライアントからのリアクションは含まれない
- **stellaタグ必須**: 通常のNIP-25リアクション（stellaタグなし）はカウントされない
