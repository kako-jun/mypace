# Supernova（スーパーノヴァ）

条件を満たすとステラが生まれるシステム。
超新星爆発のように、エネルギーがたまり限界に達すると新しい星が生まれる。

## 概要

- ユーザーが特定の条件を達成すると「Supernova」が解除される
- Supernova解除時にカラーステラが付与される
- インベントリページで進捗と達成済みSupernovaを確認できる
- **判定タイミング**: API側（POST /api/supernovas/check）で判定

## ステラカラーについて

| カラー | 特徴 | バランス管理 |
|--------|------|-------------|
| Yellow | 無限に使用可能 | 管理不要 |
| Green | 消費型 | 残高管理あり |
| Red | 消費型、レア | 残高管理あり |
| Blue | 消費型、超レア | 残高管理あり |
| Purple | 消費型、最高レア | 残高管理あり |

**重要**: Yellow ステラは無限なので、報酬としては付与しない。

## Supernova一覧

### 1. 単発系（Single）

1回のみ達成できるSupernova。

| ID | 名称 | 条件 | 判定タイミング | 報酬 |
|----|------|------|---------------|------|
| `first_post` | First Post | 初めての投稿 | 投稿時 | Green ×1 |
| `first_received_stella` | First Received Stella | 初めてステラを受け取る | ステラ受信時 | Green ×1 |
| `first_given_stella` | First Given Stella | 初めてステラを送る | ステラ送信時 | Green ×1 |

### ペンギンシリーズ（参加番号）

参加番号（シリアルナンバー）に応じて解除。番号が小さいほど高いティア。

| ID | 名称 | 条件 | 判定タイミング | 報酬 |
|----|------|------|---------------|------|
| `penguin_1000` | Penguin 1000 | 参加番号1000番以内 | 初回投稿時 | Green ×1 |
| `penguin_500` | Penguin 500 | 参加番号500番以内 | 初回投稿時 | Green ×10, Red ×1 |
| `penguin_250` | Penguin 250 | 参加番号250番以内 | 初回投稿時 | Green ×100, Red ×10, Blue ×1 |
| `penguin_100` | Penguin 100 | 参加番号100番以内 | 初回投稿時 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |

### 2. コンテンツ系（Single）

投稿内容に関するSupernova。

| ID | 名称 | 条件 | 判定タイミング | 報酬 |
|----|------|------|---------------|------|
| `first_teaser` | First Teaser | ティーザータグ付き投稿 | 投稿時 | - |
| `first_super_mention` | First Super Mention | スーパーメンション使用 | 投稿時 | - |
| `first_image` | First Image | 画像付き投稿 | 投稿時 | - |
| `first_voice` | First Voice | ボイスメモ投稿 | 投稿時 | - |
| `first_map` | First Map | 地図付き投稿 | 投稿時 | - |
| `first_reply` | First Reply | 初めてリプライ | 投稿時 | Green ×1 |
| `first_repost` | First Repost | 初めてリポスト | リポスト時 | Green ×1 |
| `first_url` | First URL | URL含む投稿 | 投稿時 | - |
| `first_table` | First Table | Markdown表を使用 | 投稿時 | Green ×1 |
| `first_list` | First List | Markdownリストを使用 | 投稿時 | - |

### 3. 長文系（Single） - 隠しSupernova

長文投稿で解除される隠しSupernova。進捗が0のうちは表示されない。

| ID | 名称 | 条件 | 判定タイミング | 報酬 |
|----|------|------|---------------|------|
| `first_long_post` | First Long Post | 281文字以上 | 投稿時 | Green ×1 |
| `first_1000_chars` | First 1000 Chars | 1000文字以上 | 投稿時 | Green ×2 |
| `first_2000_chars` | First 2000 Chars | 2000文字以上 | 投稿時 | Green ×3, Red ×1 |
| `first_3000_chars` | First 3000 Chars | 3000文字以上 | 投稿時 | Green ×3, Red ×2, Blue ×1 |
| `first_4000_chars` | First 4000 Chars | 4000文字以上 | 投稿時 | Green ×3, Red ×2, Blue ×2, Purple ×1 |

### 4. 受け取ったステラ系（Cumulative）

累計で受け取ったステラ数に応じて解除。

**報酬ルール（×10法則）**:
- グリーンSupernova: Green ×1
- レッドSupernova: Green ×10, Red ×1
- ブルーSupernova: Green ×100, Red ×10, Blue ×1
- パープルSupernova: Green ×1000, Red ×100, Blue ×10, Purple ×1

| ID | 名称 | 条件 | Supernova色 | 報酬 |
|----|------|------|------------|------|
| `received_green_10` | Received Green 10 | Green 10個受信 | 緑 | Green ×1 |
| `received_green_100` | Received Green 100 | Green 100個受信 | 緑 | Green ×1 |
| `received_green_1000` | Received Green 1000 | Green 1000個受信 | 赤 | Green ×10, Red ×1 |
| `received_red_10` | Received Red 10 | Red 10個受信 | 赤 | Green ×10, Red ×1 |
| `received_red_100` | Received Red 100 | Red 100個受信 | 赤 | Green ×10, Red ×1 |
| `received_red_1000` | Received Red 1000 | Red 1000個受信 | 青 | Green ×100, Red ×10, Blue ×1 |
| `received_blue_10` | Received Blue 10 | Blue 10個受信 | 青 | Green ×100, Red ×10, Blue ×1 |
| `received_blue_100` | Received Blue 100 | Blue 100個受信 | 青 | Green ×100, Red ×10, Blue ×1 |
| `received_blue_1000` | Received Blue 1000 | Blue 1000個受信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |
| `received_purple_10` | Received Purple 10 | Purple 10個受信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |
| `received_purple_100` | Received Purple 100 | Purple 100個受信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |
| `received_purple_1000` | Received Purple 1000 | Purple 1000個受信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |

### 5. 送ったステラ系（Cumulative）

累計で送ったステラ数に応じて解除。報酬ルールは受け取ったステラ系と同様。

| ID | 名称 | 条件 | Supernova色 | 報酬 |
|----|------|------|------------|------|
| `given_green_10` | Given Green 10 | Green 10個送信 | 緑 | Green ×1 |
| `given_green_100` | Given Green 100 | Green 100個送信 | 緑 | Green ×1 |
| `given_green_1000` | Given Green 1000 | Green 1000個送信 | 赤 | Green ×10, Red ×1 |
| `given_red_10` | Given Red 10 | Red 10個送信 | 赤 | Green ×10, Red ×1 |
| `given_red_100` | Given Red 100 | Red 100個送信 | 赤 | Green ×10, Red ×1 |
| `given_red_1000` | Given Red 1000 | Red 1000個送信 | 青 | Green ×100, Red ×10, Blue ×1 |
| `given_blue_10` | Given Blue 10 | Blue 10個送信 | 青 | Green ×100, Red ×10, Blue ×1 |
| `given_blue_100` | Given Blue 100 | Blue 100個送信 | 青 | Green ×100, Red ×10, Blue ×1 |
| `given_blue_1000` | Given Blue 1000 | Blue 1000個送信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |
| `given_purple_10` | Given Purple 10 | Purple 10個送信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |
| `given_purple_100` | Given Purple 100 | Purple 100個送信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |
| `given_purple_1000` | Given Purple 1000 | Purple 1000個送信 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |

### 6. 投稿回数系（Cumulative）

Nostr全体での投稿回数に応じて解除。Primalから取得するため、MY PACE外の投稿も含む。

| ID | 名称 | 条件 | Supernova色 | 報酬 |
|----|------|------|------------|------|
| `posts_10` | Posts 10 | 10回投稿 | 緑 | Green ×1 |
| `posts_100` | Posts 100 | 100回投稿 | 赤 | Green ×10, Red ×1 |
| `posts_1000` | Posts 1000 | 1000回投稿 | 青 | Green ×100, Red ×10, Blue ×1 |

**注意**: 投稿回数はNostr全体でカウントされるため、既に数万回投稿しているユーザーはMY PACEで初めて投稿した瞬間に複数のSupernovaを同時達成する可能性がある。

### 7. メタ系（Cumulative）

Supernova達成数に応じて解除。

| ID | 名称 | 条件 | Supernova色 | 報酬 |
|----|------|------|------------|------|
| `first_supernova` | First Supernova | 1個達成 | 緑 | Green ×1 |
| `supernova_10` | Supernova 10 | 10個達成 | 赤 | Green ×10, Red ×1 |
| `supernova_25` | Supernova 25 | 25個達成 | 青 | Green ×100, Red ×10, Blue ×1 |
| `supernova_50` | Supernova 50 | 50個達成 | 紫 | Green ×1000, Red ×100, Blue ×10, Purple ×1 |

## 判定フロー

```
[ユーザーアクション]
      ↓
[GUI: recordEvent() / checkSupernovas()]
      ↓
[API: POST /api/supernovas/check]
      ↓
[条件判定]
  - D1から取得: ステラ受信/送信数、シリアル番号、解除済みSupernova
  - Primalから取得: 投稿回数
      ↓
[解除処理]
  - user_supernovasにレコード追加
  - user_stella_balanceに報酬付与
      ↓
[レスポンス: newlyUnlocked]
      ↓
[GUI: 祝福モーダル表示]
```

## 祝福モーダル（Celebration Modal）

Supernovaを達成した際に表示される祝福モーダル。

### デザイン

- **形状**: 真円（320x320px）、黒枠（3px）
- **背景**: 暗いバックドロップ（rgba(0, 0, 0, 0.85)）
- **アニメーション**: スパークルパーティクル + アイコンパルス
- **z-index**: 2000（最前面）

### 表示内容（すべて英語）

1. **アイコン**: Sparkles（色はSupernova色に対応）
2. **タイトル**: "Supernova Unlocked!"
3. **名前**: Supernovaの名前（Supernova色で表示）
4. **説明**: 名前と異なる場合のみ表示
5. **報酬**: ステラアイコン + 数量（報酬がある場合）
6. **リンク**: "View in Inventory"
7. **ヒント**: "Tap anywhere to continue"

### 閉じる方法

- バックドロップをタップ/クリック
- Escapeキー
- 5秒後に自動クローズ
- "View in Inventory"リンクをクリック

### キュー処理

複数のSupernovaを同時達成した場合、キューで順番に表示。
1つのモーダルが閉じると、次のモーダルが300ms後に表示される。

### コンポーネント構成

```
apps/web/src/
├── components/supernova/
│   ├── SupernovaCelebration.tsx  # CelebrationProvider + Modal
│   └── index.ts                  # exports
└── styles/components/
    └── supernova-celebration.css # アニメーション・スタイル
```

### 使用方法

```tsx
// App.tsx - Providerでラップ
import { CelebrationProvider } from './components/supernova'

function App() {
  return (
    <CelebrationProvider>
      {/* ... */}
    </CelebrationProvider>
  )
}

// PostForm.tsx - Supernovaチェック後に呼び出し
import { useCelebration } from '../supernova'

function PostForm() {
  const { celebrate } = useCelebration()

  const handlePost = async () => {
    // ... post logic
    const result = await checkSupernovas(pubkey, 'first_post')
    if (result.newlyUnlocked.length > 0) {
      celebrate(result.newlyUnlocked)
    }
  }
}
```

## DBスキーマ

### supernova_definitions

```sql
CREATE TABLE IF NOT EXISTS supernova_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'single',  -- 'single' or 'cumulative'
  threshold INTEGER DEFAULT 1,              -- 累計系の閾値
  supernova_color TEXT DEFAULT 'yellow',    -- Supernovaアイコンの色
  reward_green INTEGER NOT NULL DEFAULT 0,
  reward_red INTEGER NOT NULL DEFAULT 0,
  reward_blue INTEGER NOT NULL DEFAULT 0,
  reward_purple INTEGER NOT NULL DEFAULT 0
);
```

**注意**: `reward_yellow`は存在しない（Yellowステラは無限のため報酬として付与しない）

### user_supernovas

```sql
CREATE TABLE IF NOT EXISTS user_supernovas (
  pubkey TEXT NOT NULL,
  supernova_id TEXT NOT NULL,
  unlocked_at INTEGER NOT NULL,
  PRIMARY KEY (pubkey, supernova_id)
);
```

### user_stella_balance

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

## API仕様

### Supernova定義一覧取得

```
GET /api/supernovas/definitions
```

### ユーザーの達成済みSupernova取得

```
GET /api/supernovas/:pubkey
```

### ユーザーのステラ統計取得（進捗表示用）

```
GET /api/supernovas/stats/:pubkey
```

レスポンス:
```json
{
  "pubkey": "abc123...",
  "received": { "yellow": 10, "green": 5, "red": 2, "blue": 1, "purple": 0 },
  "given": { "yellow": 3, "green": 1, "red": 0, "blue": 0, "purple": 0 }
}
```

### Supernovaチェック・解除

```
POST /api/supernovas/check
```

リクエスト:
```json
{
  "pubkey": "abc123...",
  "event": "first_post"  // optional: トリガーイベント
}
```

レスポンス:
```json
{
  "success": true,
  "newlyUnlocked": [
    { "id": "first_post", "name": "First Post", ... }
  ],
  "totalUnlocked": 3
}
```

### Supernova定義のシード（管理用）

```
POST /api/supernovas/seed
```

## インベントリページ表示ルール

### 進捗中Supernova（上部）

1. 進捗が1以上のものを表示（0は非表示）
2. シリーズ内で前のティアが未達成なら非表示
3. **ソート順**:
   1. 進捗率（高い順）
   2. Supernova色（緑→赤→青→紫）
   3. 名前（アルファベット順）

### 達成済みSupernova（下部）

1. 達成日時付きで表示
2. **ソート順**:
   1. 達成日時（新しい順）
   2. 同じ日時の場合、シリーズ内の高いティアが先

## 今後の拡張候補

- 特定時間帯投稿系（深夜投稿など）
- 季節イベント系（期間限定Supernova）
