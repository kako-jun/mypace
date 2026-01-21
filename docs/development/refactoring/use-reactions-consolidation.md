# useReactions 統合調査・計画

## 現状分析

### ステラロジックが存在する3箇所

| ファイル | 状態管理 | 使用状況 |
|---------|---------|---------|
| `useTimeline.ts` | `reactions: { [eventId: string]: ReactionData }` | ✅ タイムラインで使用 |
| `PostView.tsx` + `usePostViewData.ts` | `reactions: ReactionData` | ✅ 個別投稿ページで使用 |
| `useReactions.ts` | `reactions: ReactionData` | ❌ 未使用 |

### 各実装の詳細

#### 1. useTimeline.ts（タイムライン）

```
Timeline.tsx
  └─ useTimeline()
       ├─ reactions state (Map: eventId → ReactionData)
       ├─ handleAddStella(event, color)
       ├─ handleUnlike(event)
       ├─ flushStella(event)
       ├─ stellaDebounceTimers ref (Map: eventId → timeout)
       └─ pendingStella ref (Map: eventId → StellaCountsByColor)
            │
            ▼
       TimelinePostCard (receives reactions[event.id], onAddStella, onUnlike)
            │
            ▼
       PostActions (receives reactions, onAddStella, onUnlike)
```

**特徴:**
- 複数イベントの reactions を一括管理
- eventId をキーにした Map 構造
- デバウンスも eventId ごとに管理

#### 2. PostView.tsx + usePostViewData.ts（個別投稿）

```
PostView.tsx
  └─ usePostViewData(eventId)
       ├─ reactions state (単一 ReactionData)
       └─ setReactions
            │
            ▼
  PostView.tsx (独自で追加)
       ├─ handleAddStella(color)
       ├─ handleUnlike()
       ├─ flushStella()
       ├─ stellaDebounceTimer ref
       └─ pendingStella ref
            │
            ▼
       PostActions (receives reactions, handleAddStella, handleUnlike)
```

**特徴:**
- 単一イベントの reactions を管理
- `usePostViewData` がデータ取得と state 所有
- `PostView` がリアクションロジックを追加

#### 3. useReactions.ts（未使用）

```
useReactions({ event, myPubkey, initialReactions })
  ├─ reactions state (単一 ReactionData)
  ├─ handleAddStella(color)
  ├─ handleUnlike()
  ├─ flushStella()
  ├─ stellaDebounceTimer ref
  └─ pendingStella ref
```

**特徴:**
- 単一イベント用の設計
- initialReactions から state を初期化
- 完全に独立した状態管理

---

## 統合の問題点

### 問題1: 状態の多重管理

```
❌ 危険なパターン

usePostViewData
  └─ reactions state ← データ取得時に初期化

useReactions
  └─ reactions state ← initialReactions から初期化

→ 2つの state が同じデータを持ち、同期が必要
→ 楽観的更新時に片方しか更新されない
→ UI不整合の原因に
```

### 問題2: タイムラインの構造

```
❌ Hooks のルール違反

// これはできない
items.map((item) => {
  const { handleAddStella } = useReactions({ event: item.event, ... })
  // ↑ ループ内で hook を呼べない
})
```

タイムラインは複数イベントを扱うため、`useReactions` をイベントごとに呼ぶことができない。

### 問題3: 状態の所有権

| コンポーネント | 状態の所有者 |
|--------------|------------|
| Timeline | useTimeline が reactions 所有 |
| PostView | usePostViewData が reactions 所有 |
| useReactions | 自身が reactions 所有したい |

→ 所有者が競合する

---

## 解決策の選択肢

### Option A: ステートレスなロジック抽出

`useReactions` を純粋なロジック関数に変更し、state は呼び出し側が管理。

```typescript
// stellaLogic.ts
export function createStellaHandlers(
  event: Event | null,
  myPubkey: string | null,
  setReactions: SetReactionsFunction,
  refs: { debounceTimer: MutableRefObject<...>, pending: MutableRefObject<...> }
) {
  const handleAddStella = (color: StellaColor) => { ... }
  const handleUnlike = async () => { ... }
  const flushStella = async () => { ... }
  return { handleAddStella, handleUnlike, flushStella }
}
```

**メリット:**
- 状態の多重管理を回避
- タイムラインでも使える（イベントごとに refs を持てば）

**デメリット:**
- React hooks ではなくなる
- refs の管理が呼び出し側の責任に

### Option B: ユーティリティ関数として抽出

ロジックの共通部分を純粋関数として抽出。

```typescript
// stellaUtils.ts
export function calculateNewStella(current: StellaCountsByColor, color: StellaColor): StellaCountsByColor
export function canAddMoreStella(myStella: StellaCountsByColor, pending: StellaCountsByColor): boolean
export async function publishStellaReaction(event: Event, stella: StellaCountsByColor): Promise<string>
```

**メリット:**
- 最もシンプル
- テストしやすい
- 既存構造を大きく変えない

**デメリット:**
- 重複コードは減るが完全にはなくならない
- デバウンスロジックは各所に残る

### Option C: 大規模リファクタリング

タイムライン・投稿詳細の両方を再設計。

**メリット:**
- 理想的なアーキテクチャを実現できる

**デメリット:**
- 工数が大きい
- リグレッションリスク高い
- 現状の動作に問題がないのに変更する必要があるか？

### Option D: useReactions を削除

未使用の `useReactions.ts` を削除し、現状維持。

**メリット:**
- 最小工数
- リスクゼロ
- 混乱を減らす（存在しないのに使われていないhookがある状態を解消）

**デメリット:**
- コード重複は残る

---

## 推奨案

### Phase 1: Option B + D の組み合わせ

1. **stellaUtils.ts を作成**
   - 共通ロジック（計算、バリデーション）を抽出
   - 各所から利用

2. **useReactions.ts を削除**
   - 未使用なので混乱の元

3. **デバウンスロジックは各所に残す**
   - refs の管理が context 依存のため
   - 無理に統合しない

### Phase 2: 将来の改善（オプション）

状態管理の大規模リファクタが必要になった場合：

1. Zustand や Jotai などの状態管理ライブラリ導入
2. reactions を global store で管理
3. コンポーネントは subscribe して使う

---

## 実装計画

### Step 1: stellaUtils.ts 作成

```typescript
// apps/web/src/lib/utils/stella.ts

import type { StellaCountsByColor, StellaColor } from '../nostr/events'

export const MAX_STELLA_PER_USER = 10

export function getTotalStellaCount(counts: StellaCountsByColor): number {
  return counts.yellow + counts.green + counts.red + counts.blue + counts.purple
}

export function canAddStella(
  current: StellaCountsByColor,
  pending: StellaCountsByColor,
  max: number = MAX_STELLA_PER_USER
): boolean {
  return getTotalStellaCount(current) + getTotalStellaCount(pending) < max
}

export function addStellaToColor(
  counts: StellaCountsByColor,
  color: StellaColor
): StellaCountsByColor {
  return { ...counts, [color]: counts[color] + 1 }
}

export function removeYellowStella(
  counts: StellaCountsByColor
): StellaCountsByColor {
  return { ...counts, yellow: 0 }
}
```

### Step 2: 各所で stellaUtils を利用

- `useTimeline.ts` の計算ロジックを stellaUtils に置き換え
- `PostView.tsx` の計算ロジックを stellaUtils に置き換え

### Step 3: useReactions.ts 削除

- ファイル削除
- `hooks/post/index.ts` から export 削除

### Step 4: 検証

- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- 手動テスト（タイムライン・投稿詳細でステラ操作）

---

## リスク評価

| リスク | 発生確率 | 影響度 | 対策 |
|-------|---------|-------|------|
| 計算ロジックの置き換えミス | 低 | 中 | ユニットテスト追加 |
| デバウンス動作変化 | 低 | 中 | デバウンスロジックは変更しない |
| 型エラー | 低 | 低 | typecheck で検出 |

---

## 結論

**useReactions を「状態を持つhook」として統合することは構造上困難。**

代わりに：
1. 共通ロジックを utility functions として抽出（軽量な共通化）
2. 未使用の useReactions.ts を削除（混乱解消）
3. デバウンス等の context 依存ロジックは各所に残す（無理に統合しない）

この方針であれば、状態の多重管理を引き起こすリスクなく、コードの重複を軽減できる。
