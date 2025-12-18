# マルチスター反応（ステラ）

1つの投稿に対して、1人のユーザーが最大10個のスター（ステラ）を付けられる機能。
NIP-25（リアクション）を拡張し、スター数をタグで管理する。

## 背景

- 通常のNostrリアクション（Kind 7）は1投稿1リアクション
- 「いいね」より強い気持ちを表現したい場合がある
- スター数で反応の強さを段階的に表現

## タグ形式

```json
["mypace_stars", "<スター数>"]
```

スター数は1〜10の整数。

## イベント形式

Kind 7（NIP-25リアクション）に`mypace_stars`タグを追加:

```json
{
  "kind": 7,
  "content": "+",
  "tags": [
    ["e", "<対象イベントID>"],
    ["p", "<対象イベント作者のpubkey>"],
    ["mypace_stars", "5"]
  ]
}
```

## 動作仕様

### スター追加

1. ユーザーがスターボタンをクリック
2. デバウンス処理（300ms）で連打を集約
3. 新しいリアクションイベントを作成（累積スター数を含む）
4. 古いリアクションイベントを削除（Kind 5）

### スター上限

- 1ユーザー1投稿あたり最大**10スター**
- 上限到達後はボタンが非活性化

### スター削除（全削除）

- 長押しまたはカウントクリックで削除確認
- 削除するとそのユーザーの全スターが消える（0に戻る）

## API仕様

### リアクション取得

```
GET /api/reactions/:eventId?pubkey=<自分のpubkey>
```

レスポンス:

```json
{
  "count": 25,           // 全ユーザーの合計スター数
  "myReaction": true,    // 自分がスターを付けたか
  "myStars": 5,          // 自分のスター数
  "myReactionId": "...", // 自分のリアクションイベントID
  "reactors": [          // リアクター一覧（新しい順）
    {
      "pubkey": "...",
      "stars": 5,
      "reactionId": "...",
      "createdAt": 1234567890
    }
  ]
}
```

### 集計ロジック

1. 対象イベントへのKind 7を全取得
2. pubkeyでグループ化し、最新のリアクションのみ採用
3. 各ユーザーの`mypace_stars`タグからスター数を取得
4. タグがない場合はデフォルト1として扱う（後方互換性）

## UI表示

### スター数表示

```
★ 25
```

合計スター数を表示。クリックでリアクター一覧ポップアップ。

### リアクター一覧

```
┌─────────────────────────┐
│ ユーザーA    ★★★★★ (5) │
│ ユーザーB    ★★★ (3)   │
│ ユーザーC    ★ (1)     │
└─────────────────────────┘
```

### 自分のスター

自分が付けたスター数に応じてボタンの状態が変化:
- 0: 空のスター
- 1-9: 塗りつぶしスター（追加可能）
- 10: 塗りつぶしスター（上限到達）

## 実装詳細

### クライアント側

```typescript
// 定数
export const MAX_STARS_PER_USER = 10
export const MYPACE_STARS_TAG = 'mypace_stars'

// リアクション作成
export async function createReactionEvent(
  targetEvent: Event,
  content: string = '+',
  starCount: number = 1
): Promise<Event> {
  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags: [
      ['e', targetEvent.id],
      ['p', targetEvent.pubkey],
      [MYPACE_STARS_TAG, String(Math.min(starCount, MAX_STARS_PER_USER))],
    ],
    content,
  }
  // 署名...
}
```

### サーバー側

```typescript
function getStarCount(event: Event): number {
  const starsTag = event.tags.find((t) => t[0] === 'mypace_stars')
  if (starsTag && starsTag[1]) {
    const count = parseInt(starsTag[1], 10)
    return isNaN(count) ? 1 : count
  }
  return 1 // デフォルト（後方互換性）
}
```

## 他のNostrクライアントでの表示

- `mypace_stars`タグは無視される
- Kind 7リアクションとして認識される
- 1リアクションとしてカウントされる（スター数は無視）

## 注意点

- スター追加のたびに新しいリアクションイベントを作成し、古いものを削除
- 削除が失敗しても新しいリアクションが有効（最新のみ採用）
- デバウンス処理により、連打時のネットワーク負荷を軽減
