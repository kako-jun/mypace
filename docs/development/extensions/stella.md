# stella（マルチスター反応）

1つの投稿に対して、1人のユーザーが最大10個のステラを付けられる機能。
NIP-25（リアクション）を拡張し、ステラ数をタグで管理する。

## 背景

- 通常のNostrリアクション（Kind 7）は1投稿1リアクション
- 「いいね」より強い気持ちを表現したい場合がある
- ステラ数で反応の強さを段階的に表現
- 複数の色で異なる気持ちを表現

## ステラの入手方法

ステラは以下の2つの方法で獲得できる:

1. **[Supernova（スーパーノヴァ）](./supernova.md)を達成する**
   - 目標達成の報酬としてステラを獲得
   - 詳細は [supernova.md](./supernova.md) を参照

2. **グリーンステラ以上を受け取る**
   - 誰かからグリーンステラ以上を受け取ると、受け取った分が自動的にインベントリに追加される
   - イエローステラは無限なので追加されない
   - 受け取ったステラは自由に使える（再送信可能）

### インベントリ管理

- ユーザーごとのステラ所持数をD1データベースで管理
- npub状態（名前未設定）のユーザーはステラを受け取れない
- ステラを送信すると所持数が減る
- ステラを受け取る、またはSupernova達成で所持数が増える

## 色の意味

| 色     | 意味             | レア度           |
| ------ | ---------------- | ---------------- |
| yellow | 基本の「いいね」 | 無限（入手不要） |
| green  | ?                | 普通             |
| red    | ?                | やや珍しい       |
| blue   | ?                | 珍しい           |
| purple | 最上級の賞賛     | 最も珍しい       |

※ 色は純粋にレア度を表す。

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

### 不正防止の仕組み

ステラのインベントリ管理は、複垢による無限増殖を防ぐ設計になっている。

#### 親子関係のみの管理

- **送った人（reactor）** と **受け取った人（author）** の関係のみをDB（`user_stella`テーブル）に記録
- 受け取った人がさらに別の人に送った場合、孫以降の関係は追跡しない
- `user_stella_balance` テーブルは各ユーザーの合計残高のみを保持（出所は記録しない）

#### 削除時の挙動

```
例: A → B（green×10）→ C（green×5）→ D（green×3）

Aがリアクションを削除した場合:
- 影響範囲: Aの残高+10、Bの残高-10（MAX(0, ...)で保護）
- C、Dには一切影響しない（孫以降は無関係）
```

#### 複垢増殖の防止

```
不正なシナリオ（防止される）:

1. 複垢A → 本垢にgreen×10を送る
   → 本垢: green +10
   → 複垢A: green -10

2. 本垢がgreen×10を使用
   → 本垢: green 0

3. 複垢Aが削除を試みる
   → 複垢A: green +10（返却）
   → 本垢: MAX(0, 0 - 10) = 0（既に使用済みなので影響なし）

結果: 複垢Aは±0、本垢は使った分だけ得る（不正な増殖はできない）
```

このように、削除時に受信者の残高も減算することで、送信→削除を繰り返す無限増殖を防いでいる。

### ステラ追加

1. ユーザーがステラボタンをクリック → カラーピッカーが表示
2. 色をクリックするとその色のステラが1つ追加
3. **所持数チェック**（その色のステラを持っているか）
4. 連打可能（ポップアップは閉じない）
5. デバウンス処理（500ms）で連打を集約
6. 新しいリアクションイベントを作成（全色の累積ステラ数を含む）
7. 古いリアクションイベントを削除（Kind 5）
8. **送信者の所持数を減らす**（API経由）
9. **受信者の所持数を増やす**（グリーンステラ以上の場合のみ、API経由）

### ステラ上限

- 1ユーザー1投稿あたり合計最大**10ステラ**（全色合計）
- 上限到達後はボタンが非活性化
- **所持数が0の色は非活性化**

### ステラ削除

- **すべての色のステラが取り消し可能**
- カラーステラを取り消すと、送信者の所持数に返却される（リファンド）
- 受信者の所持数からも減算される（MAX(0, ...)で保護）
- イエローステラは無限なので返却・減算の概念はない

取り消し手順:

1. カラーピッカーを開く
2. 取り消したい色の⋮アイコンをクリック
3. リアクター一覧で自分の「Remove」をクリック

その色のステラのみ0になり、他の色は残る。
すべての色が0になると、リアクション自体が削除される。

**注意**:

- 一度達成したSupernovaは取り消しても維持される（不正防止）
- 受信者が既にそのステラを使用済みの場合、残高は0で止まる（マイナスにならない）

## UI表示

### ステラ表示（投稿カード）

リプライ・リポストと同じスタイルで、各色の星と数字が横並びで表示される:

```
🌟  💚  💙
 3   2   1
```

**表示ルール**:

- イエローは常に表示される
- その他の色は1つ以上付けられた場合のみ表示される
- 色の並び順: イエロー → グリーン → レッド → ブルー → パープル

**操作**:

- どの色の星をクリックしても同じカラーピッカーが開く
- ホバー時はすべての星が一緒に拡大される（個別ではなくグループとして）

### カラーピッカー

```
┌────────────────────────────────────┐
│ Add Stella                    [x] │
├────────────────────────────────────┤
│  🌟  💚  ❤️  💙  💜               │
│  3   2        1                   │  ← 自分が付けた数
│  ⋮   ⋮   ⋮   ⋮   ⋮               │  ← 内訳表示アイコン
├────────────────────────────────────┤
│ Your Stella: 🌟×10 💚×5 ❤️×2 💙×1 │  ← 所持数
└────────────────────────────────────┘
```

- 所持数が0の色は非活性化（グレーアウト）
- 上限（10）に達すると全ボタン非活性化

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
  yellow: 0,
  green: 0,
  red: 0,
  blue: 0,
  purple: 0,
}

// 定数
export const MAX_STELLA_PER_USER = 10
export const STELLA_TAG = 'stella'
export type StellaColor = 'yellow' | 'green' | 'red' | 'blue' | 'purple'
```

## 他のNostrクライアントでの表示

- `stella`タグは無視される
- Kind 7リアクションとして認識される
- 1リアクションとしてカウントされる（ステラ数は無視）

## ユーザー累計ステラ数

ユーザーページに、そのユーザーが獲得した累計ステラ数を表示する機能。

### DBスキーマ

1ユーザーが1投稿に対して、色ごとにステラを送れる（複数行になる）。

#### user_stella（授受記録）

直接の送受信関係のみを記録（親子関係）。

```sql
CREATE TABLE IF NOT EXISTS user_stella (
  event_id TEXT NOT NULL,           -- ステラを受けた投稿
  author_pubkey TEXT NOT NULL,      -- 投稿者（受け取った人）
  reactor_pubkey TEXT NOT NULL,     -- ステラを送った人
  stella_count INTEGER NOT NULL,    -- その色のステラ数（1-10）
  stella_color TEXT NOT NULL DEFAULT 'yellow',  -- ステラの色
  reaction_id TEXT,                 -- リアクションイベントID（削除用）
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, reactor_pubkey, stella_color)
);

CREATE INDEX IF NOT EXISTS idx_user_stella_author ON user_stella(author_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_stella_reactor ON user_stella(reactor_pubkey);
CREATE INDEX IF NOT EXISTS idx_user_stella_reaction ON user_stella(reaction_id);
CREATE INDEX IF NOT EXISTS idx_user_stella_event_reactor ON user_stella(event_id, reactor_pubkey);
```

#### user_stella_balance（インベントリ）

各ユーザーの合計残高を保持（出所は追跡しない）。

```sql
CREATE TABLE IF NOT EXISTS user_stella_balance (
  pubkey TEXT PRIMARY KEY,
  yellow INTEGER NOT NULL DEFAULT 0,  -- 使用されない（無限）
  green INTEGER NOT NULL DEFAULT 0,
  red INTEGER NOT NULL DEFAULT 0,
  blue INTEGER NOT NULL DEFAULT 0,
  purple INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
```

#### 処理フロー

**ステラ受信時**:

1. `user_stella` テーブルに授受記録を挿入/更新
2. 差分を計算（前回のカウントとの差）
3. グリーンステラ以上の場合、差分を `user_stella_balance` に加算（受信者）
4. 送信時に既に減算済み（送信者）

**ステラ削除時**:

1. `user_stella` テーブルから該当レコードを削除
2. 送信者の `user_stella_balance` に返却（加算）
3. 受信者の `user_stella_balance` から減算（MAX(0, ...)で保護）
4. 孫以降の関係には影響しない

### API仕様

#### ステラ所持数取得

```
GET /api/stella-balance/:pubkey
```

レスポンス:

```json
{
  "pubkey": "abc123...",
  "balance": {
    "yellow": 10,
    "green": 5,
    "red": 2,
    "blue": 1,
    "purple": 0
  },
  "updatedAt": 1234567890
}
```

#### ステラ送信（所持数を減らす）

```
POST /api/stella-balance/send
```

リクエストボディ:

```json
{
  "pubkey": "abc123...",
  "yellow": 2,
  "green": 1
}
```

レスポンス:

```json
{
  "success": true,
  "newBalance": {
    "yellow": 8,
    "green": 4,
    "red": 2,
    "blue": 1,
    "purple": 0
  }
}
```

エラー（所持数不足）:

```json
{
  "error": "Insufficient balance for yellow"
}
```

#### ステラ統計（旧エンドポイント）

```
GET /api/user/:pubkey/stats
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
  "givenStellaCount": 567,
  "givenStellaByColor": {
    "yellow": 400,
    "green": 100,
    "red": 50,
    "blue": 15,
    "purple": 2
  }
}
```
