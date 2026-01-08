# フィルタ機能リファクタリング計画

## 現状の問題

### 1. フロントエンド vs API フィルタの混在

**問題**: フロントエンドでフィルタすると、APIから50件取得後に除外するため、全件NGの場合0件表示になる。

| フィルタ | 現在の場所 | 問題 |
|---------|-----------|------|
| `muteList` | FE (Timeline.tsx) | 50件取得後に除外 |
| `hideNPC` | FE (Timeline.tsx) | 50件取得後に除外 |
| `ngWords` | FE (TimelinePostCard) | リプライのみ対応 |
| `ngTags` | FE (TimelinePostCard) | リプライのみ対応 |
| `query` | 未実装 | - |
| `tags` (OKタグ) | 未実装 | - |

**正しい設計**: 全てAPI側でフィルタし、フィルタ後の結果から50件を返す。

### 2. 適用タイミングの不統一

| フィルタ | 保存 | 適用 | isDirty |
|---------|-----|------|---------|
| 通常フィルタ | Save時 | Save時 | ✓ |
| muteList | 即時 | 即時 | ✗ |

**問題**: muteListだけ即時適用され、Saveボタンとの連携がない。

### 3. URL連携の不完全

**SearchFiltersに含まれるがAPIで未実装:**
- `query` (q=)
- `ngWords` (ng=)
- `tags` (tags=)
- `ngTags` (ngtags=)
- `hideNPC` (npc=hide)

**SearchFiltersに含まれない:**
- `muteList`

### 4. ユーザーページでのフィルタ

**ニーズ**: `/user/:npub` ページで、そのユーザーの投稿をフィルタで絞り込みたい。

**現状**: ユーザーページは `/api/user/:pubkey/events` を使用し、フィルタパラメータを受け付けない。

---

## 解決案

### 案A: 全フィルタをAPI側に統一

```
フロントエンド                    API
┌─────────────┐                ┌─────────────────┐
│ FilterPanel │ ─── Save ───> │ /api/timeline   │
│ (URL更新)   │                │ 全フィルタ処理  │
└─────────────┘                │ 結果から50件返却│
                               └─────────────────┘
```

**変更内容:**

1. **API拡張** (`apps/api/src/routes/timeline.ts`)
   - `mute` パラメータ追加（pubkeyカンマ区切り）
   - `hideNPC` パラメータ追加
   - `ng` パラメータ追加（NGワード）
   - `ngtags` パラメータ追加
   - `q` パラメータ追加（検索クエリ）
   - `tags` パラメータ追加（OKタグ）

2. **URL連携** (`apps/web/src/lib/utils/navigation/navigation.ts`)
   - `muteList` をSearchFiltersに追加
   - `buildSearchUrl` / `parseSearchParams` でmuteList対応

3. **MuteListManager統合** (`apps/web/src/components/filter/`)
   - FilterPanelでmuteList状態を管理
   - isDirty計算に含める
   - 即時適用を廃止

4. **フロントエンドフィルタ削除** (`apps/web/src/components/timeline/`)
   - Timeline.tsx: muteList, hideNPCのFEフィルタ削除
   - TimelinePostCard.tsx: ngWords, ngTagsのFEフィルタ削除

5. **ユーザーページ対応** (`apps/api/src/routes/user-events.ts`)
   - 同様のフィルタパラメータを追加

### 案B: muteListはブラウザURLから除外

muteListは性質上、共有URLに含めるとプライバシー問題がある。

```
URLの2種類:
1. ブラウザURL（共有用）: /?q=検索&tags=nostr など
   → muteListを含まない
   → 他人に共有しても問題ない

2. APIリクエストURL: /api/timeline?q=検索&tags=nostr&mute=pubkey1,pubkey2
   → muteListをパラメータとして含む
   → ブラウザのアドレスバーには表示されない
   → サーバー側でフィルタ処理
```

**メリット:**
- 共有URLにmuteListが含まれない（プライバシー保護）
- 他人のタイムラインに自分のミュート設定が影響しない
- API側で正しくフィルタ処理できる

**ポイント:**
- ブラウザURL = `buildSearchUrl()` で生成（muteList除外）
- APIリクエスト = `fetchTimeline()` でmuteListを追加

---

## 推奨案: 案B（muteListはURL連携から除外）

### 実装計画

#### Phase 1: API側フィルタ実装

```typescript
// apps/api/src/routes/timeline.ts
timeline.get('/', async (c) => {
  // 既存パラメータ
  const limit = Number(c.req.query('limit')) || 50
  const hideAds = c.req.query('hideAds') !== '0'
  const hideNSFW = c.req.query('hideNSFW') !== '0'

  // 新規パラメータ
  const hideNPC = c.req.query('hideNPC') === '1'
  const muteParam = c.req.query('mute') || ''
  const mutedPubkeys = muteParam ? muteParam.split(',') : []
  const ngWords = (c.req.query('ng') || '').split(',').filter(Boolean)
  const ngTags = (c.req.query('ngtags') || '').split(',').filter(Boolean)
  const query = c.req.query('q') || ''
  const okTags = (c.req.query('tags') || '').split(/[+,]/).filter(Boolean)

  // フィルタ処理...
})
```

#### Phase 2: MuteListManager統合

```typescript
// FilterPanel.tsx
export function FilterPanel({ filters }) {
  // muteListもローカル状態で管理
  const [localMuteList, setLocalMuteList] = useState<string[]>([])

  // 初期化時にlocalStorageから読み込み
  useEffect(() => {
    setLocalMuteList(getMutedPubkeys())
  }, [])

  // isDirtyにmuteList変更を含める
  const isDirty = /* 既存条件 */ ||
    !arraysEqual(localMuteList, getMutedPubkeys())

  // Save時にmuteListも保存
  const handleApply = () => {
    saveMuteList(localMuteList)
    // URL更新（muteList以外）
    navigate(buildSearchUrl(newFilters))
  }
}
```

#### Phase 3: API呼び出し時にmuteList送信

```typescript
// apps/web/src/lib/api/api.ts
export async function fetchTimeline(options: TimelineOptions) {
  const params = new URLSearchParams()
  // ... 既存パラメータ

  // muteListはlocalStorageから取得してパラメータに追加
  const mutedPubkeys = getMutedPubkeys()
  if (mutedPubkeys.length > 0) {
    params.set('mute', mutedPubkeys.join(','))
  }

  const res = await fetch(`${API_BASE}/api/timeline?${params}`)
}
```

#### Phase 4: ユーザーページ対応

```typescript
// apps/api/src/routes/user-events.ts
// 同様のフィルタパラメータを追加
userEvents.get('/:pubkey/events', async (c) => {
  const hideNPC = c.req.query('hideNPC') === '1'
  const ngWords = (c.req.query('ng') || '').split(',').filter(Boolean)
  // ...
})
```

---

## フィルタ設計（最終形）

### 基本方針

**フィルタポップアップはホーム (`/`) 専用**
- ホームページのタイムラインにのみ適用
- 他のページには一切適用しない
- URL直指定なら何でも見れる（NGワード含む投稿も）

**共有URLは本人と他人で同じ見た目**
- ユーザーページ、タグページ、投稿ページは共有用途
- 個人設定フィルタ（muteList, ngWords等）を適用すると、本人と他人で見た目が異なってしまう
- 本人が「この見た目でOK」と確認した状態が他人にも表示されることが重要

### ページ別の挙動

#### ホーム `/`（タイムライン）

フィルタポップアップで設定、Save必要。
全フィルタをAPI側で処理し、結果から50件返却。

| フィルタ | APIパラメータ | API処理 | 備考 |
|---------|-------------|---------|------|
| mypace | `all=1` (OFF時) | ✓ | #mypaceタグ |
| showSNS | `kinds` | ✓ | kind 1 |
| showBlog | `kinds` | ✓ | kind 30023 |
| hideAds | `hideAds=0` (OFF時) | ✓ | 広告タグ除外 |
| hideNSFW | `hideNSFW=0` (OFF時) | ✓ | content-warning除外 |
| hideNPC | `hideNPC=1` | 要実装 | kind 42000除外 |
| lang | `lang=ja` | ✓ | 言語フィルタ |
| ngWords | `ng=word1,word2` | 要実装 | NGワード |
| ngTags | `ngtags=tag1,tag2` | 要実装 | NGタグ |
| muteList | `mute=pubkey1,pubkey2` | 要実装 | ミュートユーザー |

※ブラウザURLには含まれない（共有URLに個人設定が漏れない）

#### ユーザーページ `/user/:npub`

**フィルタポップアップは使用しない。**
デフォルトで全投稿を表示。

専用のシンプルなフィルタUI（ポスト回数の下あたり）:
- `tags` のみ指定可能（OK方向のみ）
- `query` のみ指定可能（検索）
- NG方向のフィルタなし
- Saveボタンなし

**UIデザイン:**
- フィルタポップアップの該当部分と見た目を似せる（同じコンポーネント流用可）
- 「適用」ボタン → URL更新、投稿一覧を再取得
- 「クリア」ボタン → フィルタ解除、素のユーザーページに戻る

**用途**: ポートフォリオとして見せたい投稿を絞り込んだ静的URLを共有
```
例: /user/npub1xxx?tags=art+illustration
→ このユーザーの #art かつ #illustration タグ付き投稿のみ表示
```

#### 個別投稿 `/post/:id`

**フィルタなし。常に表示。**
URL直指定なら何でも見れる。

#### タグページ `/tag/:tag`

**フィルタポップアップは使用しない。**
URLで指定されたタグの投稿を全て表示。

理由：本人が確認した見た目と、共有先の他人が見る見た目を一致させるため。
もしmuteList等が適用されると、本人には見えない投稿が他人には見えてしまう。

---

## タスク

### Phase 1: API側フィルタ実装（タイムライン用）

- [ ] API: `hideNPC=1` パラメータ追加（kind 42000除外）
- [ ] API: `mute=pubkey1,pubkey2` パラメータ追加（pubkey除外）
- [ ] API: `ng=word1,word2` パラメータ追加（NGワード本文マッチ除外）
- [ ] API: `ngtags=tag1,tag2` パラメータ追加（NGタグ除外）

### Phase 2: フロントエンド タイムラインフィルタ

- [ ] FE: MuteListManagerをFilterPanelに統合（isDirty連携）
- [ ] FE: 即時適用イベント (`mypace:muteListChanged`) 削除
- [ ] FE: `fetchTimeline` で全フィルタをAPIに送信
- [ ] FE: Timeline.tsxのFEフィルタ削除（muteList, hideNPC）
- [ ] FE: TimelinePostCard.tsxのFEフィルタ削除（ngWords, ngTags）
- [ ] FE: ブラウザURLからフィルタパラメータを削除（`/` のみに）

### Phase 3: ユーザーページ専用フィルタ

- [ ] API: `/api/user/:pubkey/events` に `tags`, `q` パラメータ追加
- [ ] FE: ユーザーページにシンプルなフィルタUI追加（ポスト回数の下）
- [ ] FE: tags入力フィールド（Saveなし、URL即時反映）
- [ ] FE: query入力フィールド（Saveなし、URL即時反映）
- [ ] FE: `/user/:npub?tags=xxx&q=yyy` のURL対応

### Phase 4: 整理

- [ ] FE: 不要になったURL解析ロジック削除（`parseSearchParams`のtags, query等）
- [ ] 型: `TimelineFilters` 型を整理
- [ ] ドキュメント: CLAUDE.md にフィルタ設計を追記
