# stella（マルチスター反応）

1つの投稿に対して、1人のユーザーが最大10個のステラを付けられる機能。
NIP-25（リアクション）を拡張し、ステラ数をタグで管理する。

## 背景

- 通常のNostrリアクション（Kind 7）は1投稿1リアクション
- 「いいね」より強い気持ちを表現したい場合がある
- ステラ数で反応の強さを段階的に表現
- 複数の色で異なる気持ちを表現

## タグ形式

1つのリアクションイベントに、色ごとのステラタグを複数含める:

```json
["stella", "<色>", "<その色のステラ数>"]
```

- 色: `yellow` | `green` | `red` | `blue` | `purple`
- ステラ数: 1〜10の整数（色ごと）
- 1ユーザーあたり合計10個まで

### 後方互換性

古い形式 `["stella", "<ステラ数>"]` もサポート。この場合、色は`yellow`として扱う。

## イベント形式

Kind 7（NIP-25リアクション）に複数の`stella`タグを追加:

```json
{
  "kind": 7,
  "content": "+",
  "tags": [
    ["e", "<対象イベントID>"],
    ["p", "<対象イベント作者のpubkey>"],
    ["stella", "yellow", "3"],
    ["stella", "green", "2"],
    ["stella", "blue", "1"]
  ]
}
```

上記の例では、イエロー3個 + グリーン2個 + ブルー1個 = 合計6個のステラを付けている。

## 動作仕様

### ステラ追加

1. ユーザーがステラボタンをクリック → カラーピッカーが表示
2. 色をクリックするとその色のステラが1つ追加
3. 連打可能（ポップアップは閉じない）
4. デバウンス処理（500ms）で連打を集約
5. 新しいリアクションイベントを作成（全色の累積ステラ数を含む）
6. 古いリアクションイベントを削除（Kind 5）

### ステラ上限

- 1ユーザー1投稿あたり合計最大**10ステラ**（全色合計）
- 上限到達後はボタンが非活性化

### ステラ削除

- **イエローステラのみ**: 削除可能
- **カラーステラが含まれる場合**: 削除不可（支払い済みのため）

削除するとそのユーザーの全ステラが消える（0に戻る）。

## カラーステラ

### 色と料金

| 色 | コスト（sats） |
|----|----------------|
| yellow | 0（無料） |
| green | 1 |
| red | 10 |
| blue | 100 |
| purple | 1000 |

### 複数色の組み合わせ

1つのリアクションで複数の色を組み合わせ可能:

- イエロー5個 + グリーン3個 + レッド2個 = 合計10個、コスト33 sats
- ブルー1個のみ = 合計1個、コスト100 sats

### Lightning支払い

カラーステラを送信する際、WebLN経由でLightning支払いを行う。

1. 送信するステラの合計コストを計算（差分のみ）
2. 投稿者のLightningアドレス（lud16）を取得
3. LNURL-pay エンドポイントから支払い情報を取得
4. インボイスを取得
5. WebLNで支払いを実行
6. 支払い成功後、リアクションイベントを発行

### 確認ダイアログ

- **なし**: 連打の楽しさを優先
- 少額のため確認なしで即時支払い

### キャンセルポリシー

- **イエローのみ**: 取り消し可能
- **カラー含む（有料）**: 取り消し不可（支払い済み）

## API仕様

### リアクション取得

```
GET /api/reactions/:eventId?pubkey=<自分のpubkey>
```

レスポンス:

```json
{
  "totalCount": 25,
  "myReaction": true,
  "myStella": {
    "yellow": 3,
    "green": 2,
    "red": 0,
    "blue": 1,
    "purple": 0
  },
  "myReactionId": "...",
  "reactors": [
    {
      "pubkey": "...",
      "stella": {
        "yellow": 5,
        "green": 0,
        "red": 0,
        "blue": 0,
        "purple": 0
      },
      "reactionId": "...",
      "createdAt": 1234567890
    }
  ]
}
```

### 集計ロジック

1. 対象イベントへのKind 7を全取得
2. pubkeyでグループ化し、最新のリアクションのみ採用
3. 各ユーザーの全`stella`タグを解析し、色ごとのカウントを取得
4. タグがない場合はデフォルト yellow: 1 として扱う（後方互換性）

## UI表示

### ステラ表示（投稿カード）

複数の色が横に並ぶ:

```
🌟3 💚2 💙1
```

各色の星の下にその色のカウントを表示。

### カラーピッカー

5色の星ボタンが横に並ぶ:

```
┌────────────────────────────────┐
│ ステラを付ける            [x] │
├────────────────────────────────┤
│  🌟  💚  ❤️  💙  💜           │
│  3   2        1              │
├────────────────────────────────┤
│ 合計: 6/10         1234 sats  │
└────────────────────────────────┘
```

- クリックでその色が+1
- 連打可能（ポップアップは閉じない）
- 上限（10）に達すると全ボタン非活性化
- 残高不足の色は非活性化

### リアクター一覧

```
┌─────────────────────────────────┐
│ ユーザーA   🌟3 💚2 💙1 (6)    │
│ ユーザーB   🌟5              │
│ ユーザーC   💜1              │
└─────────────────────────────────┘
```

各リアクターの色別カウントを表示。

## 実装詳細

### クライアント側

```typescript
// 型定義
export interface StellaCountsByColor {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

export const EMPTY_STELLA_COUNTS: StellaCountsByColor = {
  yellow: 0, green: 0, red: 0, blue: 0, purple: 0
}

// 定数
export const MAX_STELLA_PER_USER = 10
export const STELLA_TAG = 'stella'
export type StellaColor = 'yellow' | 'green' | 'red' | 'blue' | 'purple'

// リアクション作成
export async function createReactionEvent(
  targetEvent: Event,
  content: string = '+',
  stellaCounts: StellaCountsByColor = { ...EMPTY_STELLA_COUNTS, yellow: 1 }
): Promise<Event> {
  const tags: string[][] = [
    ['e', targetEvent.id],
    ['p', targetEvent.pubkey],
  ]

  // 各色のステラタグを追加
  for (const color of ['yellow', 'green', 'red', 'blue', 'purple']) {
    if (stellaCounts[color] > 0) {
      tags.push([STELLA_TAG, color, String(Math.min(stellaCounts[color], MAX_STELLA_PER_USER))])
    }
  }

  const template: EventTemplate = {
    kind: 7,
    created_at: unixNow(),
    tags,
    content,
  }
  // 署名...
}

// ステラタグ解析
export function parseStellaTags(tags: string[][]): StellaCountsByColor {
  const counts: StellaCountsByColor = { ...EMPTY_STELLA_COUNTS }
  const stellaTags = tags.filter((t) => t[0] === 'stella')

  for (const tag of stellaTags) {
    if (tag.length >= 3 && isValidStellaColor(tag[1])) {
      // 新形式: ["stella", "blue", "5"]
      counts[tag[1] as StellaColor] = Math.min(parseInt(tag[2], 10), MAX_STELLA_PER_USER)
    } else if (tag.length >= 2) {
      // 旧形式: ["stella", "5"]
      counts.yellow = Math.min(parseInt(tag[1], 10), MAX_STELLA_PER_USER)
    }
  }
  return counts
}

// 合計ステラ数
export function getTotalStellaCount(counts: StellaCountsByColor): number {
  return counts.yellow + counts.green + counts.red + counts.blue + counts.purple
}
```

### サーバー側

```typescript
interface StellaCountsByColor {
  yellow: number
  green: number
  red: number
  blue: number
  purple: number
}

function parseStellaTags(tags: string[][]): StellaCountsByColor {
  const counts = { yellow: 0, green: 0, red: 0, blue: 0, purple: 0 }
  const stellaTags = tags.filter((t) => t[0] === 'stella')

  for (const tag of stellaTags) {
    if (tag.length >= 3) {
      const color = tag[1]
      const count = parseInt(tag[2], 10)
      if (color in counts && !isNaN(count)) {
        counts[color] = count
      }
    } else if (tag.length >= 2) {
      counts.yellow = parseInt(tag[1], 10) || 1
    }
  }

  // タグがない場合のデフォルト
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) {
    counts.yellow = 1
  }

  return counts
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
- 複数色は1つのリアクションイベントにまとめて送信

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
  stella_color TEXT DEFAULT 'yellow', -- ステラの色
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

ユーザーステラ統計は `/api/user/:pubkey/count` で取得:

```
GET /api/user/:pubkey/count
```

レスポンス:

```json
{
  "postsCount": 100,
  "stellaCount": 1234,
  "stellaByColor": {
    "yellow": 1000,
    "green": 150,
    "red": 60,
    "blue": 20,
    "purple": 4
  },
  "viewsCount": { ... }
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

### バックフィル（初期データ投入）

既存のステラをD1に一括登録するためのローカルスクリプト。

```bash
cd apps/api
npx tsx scripts/backfill-stella.ts [--clear]
```

**オプション:**

| オプション | 説明 |
|-----------|------|
| `--clear` | 実行前に全レコードを削除 |

**処理内容:**

1. リレーからKind 7を全取得（ページネーション対応）
2. stellaタグがないKind 7は無視
3. 同一ユーザー・同一投稿への複数リアクションは最新のみ採用
4. D1にバッチUPSERT

**特徴:**

- **冪等性**: 何度実行しても安全（UPSERTで重複なし）
- **全クリア対応**: `--clear`でデータのズレをリセット可能
- **最新優先**: 同一ユーザーの複数リアクションは`created_at`が最新のものを採用
- **セキュア**: 公開APIではなくローカル実行のみ

**実行例:**

```bash
# apps/apiディレクトリで実行
cd /path/to/mypace/apps/api

# 追加/上書きのみ
npx tsx scripts/backfill-stella.ts

# 全クリアしてから再取得
npx tsx scripts/backfill-stella.ts --clear
```
