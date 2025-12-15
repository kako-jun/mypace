# ユーザー通し番号機能計画

## 概要

mypaceへの参加順に通し番号を付与。
初期ユーザーへのメリットを提供し、早期参加のインセンティブを作る。

## コンセプト

- 最初に参加したユーザーが #1
- 番号は永久に変わらない
- 低い番号 = 古参 = 特別
- 商売している人は早期参加で露出増

## 番号の付与

### 付与タイミング

```
ユーザーが初めて #mypace 投稿をした時点で番号確定
```

- Kind 0（プロフィール）ではなく
- Kind 1（投稿）+ #mypace タグが条件
- 初投稿のcreated_atで順位決定

### 番号の管理

**方法1: API/D1で管理**
```typescript
// D1テーブル
CREATE TABLE user_serial (
  pubkey TEXT PRIMARY KEY,
  serial_number INTEGER UNIQUE,
  first_post_at INTEGER,
  first_post_id TEXT
);

// 新規ユーザー登録
INSERT INTO user_serial (pubkey, serial_number, first_post_at, first_post_id)
VALUES (?, (SELECT COALESCE(MAX(serial_number), 0) + 1 FROM user_serial), ?, ?);
```

**方法2: Nostrイベントで記録**
```json
{
  "kind": 30078,  // App-specific data
  "content": "",
  "tags": [
    ["d", "mypace-serial"],
    ["serial", "1", "<pubkey1>", "<first_post_id>"],
    ["serial", "2", "<pubkey2>", "<first_post_id>"],
    ...
  ]
}
```

## 表示

### プロフィールでの表示

```
┌─ プロフィール ────────────────────────┐
│                                      │
│  [アバター]  @username               │
│             mypace #42               │
│             ─────────                │
│             (42番目の参加者)          │
│                                      │
│  自己紹介テキスト...                  │
│                                      │
└──────────────────────────────────────┘
```

### バッジ表示

| 番号 | バッジ | 意味 |
|------|--------|------|
| #1-10 | 🥇 創設メンバー | 最初の10人 |
| #11-100 | 🥈 初期メンバー | 最初の100人 |
| #101-1000 | 🥉 アーリーアダプター | 最初の1000人 |
| #1001+ | 一般 | それ以降 |

## ABOUTページのユーザー一覧

### 表示順

```
┌─ ABOUT ──────────────────────────────────┐
│                                          │
│  mypaceについて                           │
│  ...説明テキスト...                       │
│                                          │
│  ─────────────────────────────────────   │
│                                          │
│  📋 ユーザー一覧 (番号順)                 │
│                                          │
│  #1   🥇 @founder     - Web3開発者       │
│  #2   🥇 @early_bird  - デザイナー       │
│  #3   🥇 @pioneer     - ブロガー         │
│  ...                                     │
│  #42  🥈 @username    - 趣味アカウント   │
│  ...                                     │
│  #1234 @newcomer     - 初心者です        │
│                                          │
│  [もっと見る]                            │
│                                          │
└──────────────────────────────────────────┘
```

### 商売利用のメリット

- #1〜#100 は常に上位表示
- プロフィールにURL設定 → サイトへ誘導
- 「古参」という信頼感
- 早期参加者の特権

## 検索・フィルター

### 番号で検索

```
┌─ ユーザー検索 ───────────────────────┐
│                                      │
│ [番号で検索: 1-100    ] [検索]       │
│                                      │
│ または                               │
│                                      │
│ [名前で検索:          ] [検索]       │
│                                      │
└──────────────────────────────────────┘
```

### フィルター

- 創設メンバーのみ
- 初期メンバーのみ
- アクティブユーザーのみ（最近投稿あり）

## 番号の特典

### 基本特典

| 番号 | 特典 |
|------|------|
| #1-10 | プロフィールに金バッジ、ABOUT最上位 |
| #11-100 | プロフィールに銀バッジ、ABOUT上位 |
| #101-1000 | プロフィールに銅バッジ |
| #1001+ | 番号表示のみ |

### 将来的な特典案

- 特別なカラーステラ購入権
- 限定機能の先行アクセス
- 特別なバーコードレアリティ補正
- 広告枠（あれば）の優先

## 実装

### APIエンドポイント

```typescript
// 番号取得
GET /api/serial/:pubkey
Response: { serial: 42, badge: "silver", firstPostAt: 1234567890 }

// ユーザー一覧
GET /api/users?sort=serial&limit=100&offset=0
Response: { users: [...], total: 1234 }

// 新規登録（内部処理）
POST /api/serial/register
Body: { pubkey, firstPostId, firstPostAt }
```

### フロントエンド

```tsx
function UserSerialBadge({ serial }: { serial: number }) {
  const badge = getBadgeType(serial)

  return (
    <span className={`serial-badge serial-${badge}`}>
      #{serial}
      {badge === 'gold' && ' 🥇'}
      {badge === 'silver' && ' 🥈'}
      {badge === 'bronze' && ' 🥉'}
    </span>
  )
}

function getBadgeType(serial: number): string {
  if (serial <= 10) return 'gold'
  if (serial <= 100) return 'silver'
  if (serial <= 1000) return 'bronze'
  return 'normal'
}
```

## 不正対策

### 番号の争奪防止

- 初投稿のタイムスタンプで厳密に判定
- 同時刻の場合はeventIdの辞書順
- 一度付与された番号は変更不可

### 偽装防止

- APIで番号を検証
- 自己申告ではなくシステム管理

## オプトアウト（Remove機能）

### 静かに暮らしたい人向け

- 番号一覧から自分を削除できる
- プロフィールの番号表示も消せる
- **番号自体は保持**（復帰時に同じ番号）

### Remove UI

```
┌─ 設定 ─────────────────────────────────┐
│                                        │
│ ユーザー番号: #42                       │
│                                        │
│ [✓] ABOUTページの一覧に表示する         │
│ [✓] プロフィールに番号を表示する        │
│                                        │
│ [一覧から削除する]                      │
│                                        │
│ ※ 番号は保持されます。                  │
│   いつでも一覧に復帰できます。           │
│                                        │
└────────────────────────────────────────┘
```

### データ構造

```sql
ALTER TABLE user_serial ADD COLUMN visible BOOLEAN DEFAULT TRUE;
```

### 削除後の表示

- ABOUT一覧: 表示されない
- プロフィール: 番号非表示
- 検索: ヒットしない
- 他のユーザーから: 存在が見えない

### 復帰

- いつでも「一覧に復帰」ボタンで戻れる
- 同じ番号のまま
- 欠番にはならない

## 注意点

- 番号は「参加順」であり「偉さ」ではない
- 低い番号 = 早かっただけ（マウント禁止の空気作り）
- 商売利用は許可するが、スパムは削除対象
- 静かに暮らしたい人はRemove可能

## 実装優先度

1. 番号付与ロジック（D1テーブル）
2. プロフィール表示
3. ABOUTページのユーザー一覧
4. バッジ表示
5. 検索・フィルター
6. 特典システム
