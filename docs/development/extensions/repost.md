# リポスト表示（kind:6）

MY PACEはNostr標準のリポスト（kind:6）イベントをタイムラインと投稿詳細ページで表示します。

## 概要

リポスト（NIP-18）はNostrの標準機能で、他のユーザーの投稿を自分のフォロワーに共有するための仕組みです。MY PACEではリポストを以下の形式で表示します：

```
┌─────────────────────────────────────┐
│ [リポストした人のアバター]            │
│ リポストした人の名前 · 時刻           │
│                                     │
│ Reposted                            │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [元投稿者のアバター]              │ │
│ │ 元投稿者の名前 · 時刻             │ │
│ │                                 │ │
│ │ 元投稿の本文...                  │ │
│ │ [位置情報]                       │ │
│ │ [ステッカー]                     │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## データ構造

### kind:6 イベント

```json
{
  "kind": 6,
  "pubkey": "リポストしたユーザーのpubkey",
  "created_at": 1234567890,
  "tags": [
    ["e", "元イベントのID", "リレーURL"],
    ["p", "元投稿者のpubkey"]
  ],
  "content": "{元イベントのJSON}",
  "sig": "..."
}
```

- `content`: 元イベントの完全なJSONが格納される（NIP-18準拠）
- `e`タグ: 元イベントへの参照
- `p`タグ: 元投稿者への参照

## 実装詳細

### 1. タイムライン取得（relay.ts）

```typescript
// fetchTimelineでkind:6も取得
const defaultKinds = [KIND_NOTE, KIND_REPOST, KIND_LONG_FORM, ...]

// リポストイベントから元イベントをパース
export function parseRepostEvent(event: Event): Event | null {
  if (event.kind !== KIND_REPOST) return null
  try {
    const parsed = JSON.parse(event.content)
    // 必須フィールドの検証
    if (parsed.id && parsed.pubkey && ...) {
      return { id: parsed.id, ... }
    }
  } catch {}
  return null
}
```

### 2. TimelineItem型（types/index.ts）

```typescript
export interface TimelineItem {
  event: Event
  repostedBy?: { pubkey: string; timestamp: number }
  originalEvent?: Event  // リポスト元イベント（kind:6の場合にセット）
}
```

### 3. useTimelineフック

- `eventsToTimelineItems()`: kind:6イベントから`originalEvent`を抽出
- リポスト元イベントの著者プロフィールも取得対象に追加
- リポスト元イベントのメタデータ（リアクション等）も取得

### 4. コンポーネント構成

```
TimelinePostCard
├─ PostHeader（リポストした人）
├─ "Reposted"テキスト
└─ OriginalPostCard（リポスト元）
   ├─ PostHeader（元投稿者）
   ├─ PostContent（元投稿内容）
   ├─ PostStickers（back/front）
   ├─ PostLocation
   └─ テーマカラー背景
```

### 5. OriginalPostCardコンポーネント

`ReplyCard`をベースに、以下をフル対応：
- テーマカラー（グラデーション背景）
- ステッカー（前面/背面レイヤー）
- 位置情報（マップ表示）
- クリックで元投稿の詳細ページへ遷移

## 表示ルール

| 要素 | リポストカード | 元投稿カード |
|------|--------------|------------|
| ヘッダー | リポストした人 | 元投稿者 |
| 本文 | 「Reposted」 | 元投稿の内容 |
| アクションボタン | 非表示 | 非表示 |
| バーコード | 非表示 | 非表示 |
| スレッドリプライ | 非表示 | 非表示 |
| ステッカー | 非表示 | 表示 |
| 位置情報 | 非表示 | 表示 |
| テーマカラー | 通常 | 元投稿のテーマ |

## 注意事項

### mypaceタグフィルタ

- mypaceモード（`#mypace`タグフィルタ）では、リポストイベント自体に`#mypace`タグがない場合は取得されない
- showAll=trueモードでは全てのリポストが取得される

### contentが空の場合

一部のクライアントは`content`を空にしてリポストを作成する場合がある。この場合：
- `parseRepostEvent`は`null`を返す
- タイムラインには表示されない（スキップ）

### プロフィール取得

リポスト表示時には以下のプロフィールを取得：
1. リポストした人のプロフィール
2. 元投稿者のプロフィール

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `lib/nostr/constants.ts` | `KIND_REPOST = 6` 定義 |
| `lib/nostr/relay.ts` | `parseRepostEvent()` 実装 |
| `types/index.ts` | `TimelineItem.originalEvent` 型定義 |
| `hooks/timeline/useTimeline.ts` | リポスト処理ロジック |
| `hooks/post/usePostViewData.ts` | 詳細ページでの元投稿者プロフィール取得 |
| `components/post/OriginalPostCard.tsx` | 元投稿表示カード |
| `components/timeline/TimelinePostCard.tsx` | リポスト条件分岐 |
| `components/post/PostView.tsx` | 詳細ページでのリポスト表示 |
| `styles/components/post-card.css` | スタイル定義 |

## 参考

- [NIP-18: Reposts](https://github.com/nostr-protocol/nips/blob/master/18.md)

---

[← 拡張一覧に戻る](./index.md)
