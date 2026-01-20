# Supernova（スーパーノヴァ）

条件を満たすとステラが生まれるシステム。
超新星爆発のように、エネルギーがたまり限界に達すると新しい星が生まれる。

## 概要

- ユーザーが特定の条件を達成すると「Supernova」が解除される
- Supernova解除時にステラ（星）と記念品が付与される
- 記念品とステラはインベントリで管理される
- ゲーミフィケーション要素としてユーザーのモチベーションを高める

## Supernova一覧

### 単発Supernova

1回のみ達成できるSupernova。

| Supernova | 条件 | 獲得ステラ（要検討） |
|-----------|------|---------------------|
| Profile Set | 名前を入力 | 初期ステラ一式 |
| First Post | 1回目の投稿 | ? |
| Gave Stella | 初めて他人にステラを送る | ? |
| Got Stella | 初めてステラを受け取る | ? |

### 段階Supernova

同じ種類で複数段階があるSupernova。達成数に応じて記念品の色が変わる。

**ステラ獲得数**

| Supernova | 条件 | 記念品の色 | 獲得ステラ（要検討） |
|-----------|------|-----------|---------------------|
| 10 Stella | 累計10個 | 🌟 Yellow | ? |
| 100 Stella | 累計100個 | 💚 Green | ? |
| 1000 Stella | 累計1000個 | ❤️ Red | ? |
| 10000 Stella | 累計10000個 | 💙 Blue | ? |
| 100000 Stella | 累計100000個 | 💜 Purple | ? |

※ 具体的な数値・報酬は要検討

## npub状態の制限

名前未設定のユーザー（npub表示状態）には以下の制限がある：

- ステラを**受け取れない**（送信側にエラー表示）
- Supernovaが達成されない
- 所持ステラは0のまま

名前を設定すると「First Light」Supernovaが達成され、初期ステラが付与される。

## DBスキーマ

### Supernovaテーブル

ユーザーが達成したSupernovaを記録。

```sql
CREATE TABLE IF NOT EXISTS user_supernovas (
  pubkey TEXT NOT NULL,
  supernova_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (pubkey, supernova_id)
);

CREATE INDEX IF NOT EXISTS idx_user_supernovas_pubkey ON user_supernovas(pubkey);
```

### Supernova定義テーブル

各Supernovaの定義と報酬を管理。

```sql
CREATE TABLE IF NOT EXISTS supernova_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  reward_yellow INTEGER NOT NULL DEFAULT 0,
  reward_green INTEGER NOT NULL DEFAULT 0,
  reward_red INTEGER NOT NULL DEFAULT 0,
  reward_blue INTEGER NOT NULL DEFAULT 0,
  reward_purple INTEGER NOT NULL DEFAULT 0
);
```

### ステラ所持数テーブル

ユーザーごとのステラ所持数を管理。

```sql
CREATE TABLE IF NOT EXISTS user_stella_balance (
  pubkey TEXT PRIMARY KEY,
  yellow INTEGER NOT NULL DEFAULT 0,
  green INTEGER NOT NULL DEFAULT 0,
  red INTEGER NOT NULL DEFAULT 0,
  blue INTEGER NOT NULL DEFAULT 0,
  purple INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
```

## API仕様

### ステラ所持数取得

```
GET /api/user/:pubkey/stella-balance
```

レスポンス:

```json
{
  "yellow": 10,
  "green": 5,
  "red": 2,
  "blue": 1,
  "purple": 0
}
```

### Supernova一覧取得

```
GET /api/user/:pubkey/supernovas
```

レスポンス:

```json
{
  "unlocked": [
    { "id": "first_light", "name": "First Light", "unlockedAt": 1234567890 }
  ],
  "locked": [
    { "id": "ignition", "name": "Ignition", "description": "最初の投稿をする" }
  ]
}
```

### Supernovaチェック・解除

ステラ送信や投稿などのアクション時に自動的にチェックされる。

```typescript
async function checkAndUnlockSupernovas(pubkey: string, db: D1Database): Promise<void> {
  // プロフィール設定チェック（First Light）
  // 投稿数チェック（Ignition）
  // ステラ累計チェック（Radiance）
  // etc.
}

async function grantStellaReward(
  pubkey: string,
  supernovaId: string,
  db: D1Database
): Promise<void> {
  const definition = await getSupernovaDefinition(supernovaId, db)
  await db.prepare(`
    UPDATE user_stella_balance
    SET yellow = yellow + ?,
        green = green + ?,
        red = red + ?,
        blue = blue + ?,
        purple = purple + ?,
        updated_at = ?
    WHERE pubkey = ?
  `).bind(
    definition.reward_yellow,
    definition.reward_green,
    definition.reward_red,
    definition.reward_blue,
    definition.reward_purple,
    Date.now(),
    pubkey
  ).run()
}
```

## UI表示

### インベントリページ

ステラと記念品を統合表示。記念品の下に進捗バーを表示し、次のSupernova達成までのゲージを示す。

```
┌─────────────────────────────────────────────────┐
│ Inventory                                       │
├─────────────────────────────────────────────────┤
│ Stella                                          │
│ 🌟×10  💚×5  ❤️×2  💙×1  💜×0                   │
├─────────────────────────────────────────────────┤
│ Trophies                                        │
│                                                 │
│ 🏆 Profile Set                                  │
│    [████████████████████] Done                  │
│                                                 │
│ 📝 First Post                                   │
│    [████████████████████] Done                  │
│                                                 │
│ 🎁 Gave Stella                                 │
│    [░░░░░░░░░░░░░░░░░░░░] 0/1                   │
│                                                 │
│ ⭐ Got Stella                              │
│    [████████████████████] Done                  │
│                                                 │
│ ── Stella Count ──────────────────────────────  │
│ 🌟 10 Stella     [████████████████████] Done    │
│ 💚 100 Stella    [██░░░░░░░░░░░░░░░░░░] 15/100  │
│ ❤️ 1000 Stella   [░░░░░░░░░░░░░░░░░░░░] 15/1000 │
└─────────────────────────────────────────────────┘
```

- **Done**: 達成済み。記念品として表示。
- **進捗バー**: 未達成のSupernovaは進捗状況を表示。
- **色違い**: 段階Supernovaは達成段階に応じて色が変わる（Yellow→Green→Red→Blue→Purple）
- Supernova専用の管理画面は不要。インベントリがすべてを兼ねる。

### Supernova解除通知

Supernova達成時にトースト通知を表示：

```
┌────────────────────────────────────┐
│ 💥 Supernova!                      │
│                                    │
│ Profile Set                        │
│ +🌟×10 +💚×3 +❤️×1                 │
└────────────────────────────────────┘
```

## 削除する機能

新システム移行に伴い、以下を削除：

- Lightning支払い（WebLN / NWC）
- ライトニングアドレス依存の処理
- インベントリのウォレット接続UI
- 設定画面のウォレットセクション

## マイグレーション

### 既存データの扱い

- 既存のステラリアクション（Kind 7 + stellaタグ）はそのまま有効
- 旧システム（Lightning支払い）で付与されたステラも累計にカウント
- 新システム移行後、全ユーザーの所持数は0からスタート
- 「移行ボーナス」として既存ユーザーに初期ステラを付与することも検討
