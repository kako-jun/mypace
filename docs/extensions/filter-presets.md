# フィルタプリセット

フィルタ設定をプリセットとして保存・切り替えできる機能。

## 概要

FilterPanelで設定したフィルタ条件（検索キーワード、タグ、NGワード、言語など）を名前付きで保存し、ワンクリックで呼び出せる。

## 仕様

- 最大10個まで保存可能
- localStorage永続化（`mypace_filter_presets`）
- 同名のプリセットは上書き保存

## データ構造

```typescript
interface FilterPreset {
  id: string           // UUID
  name: string         // ユーザー指定名
  filters: SearchFilters
  createdAt: number    // timestamp
}
```

## UI

FilterPanel上部にプリセットセクションを配置:

```
┌─────────────────────────────────┐
│ [Preset(3) ▼] [💾] [🗑️]        │
├─────────────────────────────────┤
│ (回路図UI)                      │
│ (OK/NG入力欄)                   │
│ (言語選択)                      │
│ [Clear] [Save]                  │
└─────────────────────────────────┘
```

- ドロップダウン: プリセット選択（件数表示）
- 💾ボタン: 現在のフィルタを保存（モーダルで名前入力）
- 🗑️ボタン: 選択中のプリセットを削除（2クリック確認）

## 操作フロー

### プリセット保存

1. フィルタを設定
2. 💾ボタンをクリック
3. モーダルで名前を入力（選択中のプリセット名がプリフィル）
4. Save → 新規作成 or 同名上書き

### プリセット適用

1. ドロップダウンでプリセット選択
2. フォームに即座に反映
3. Saveボタンで検索実行

### プリセット削除

1. ドロップダウンでプリセット選択
2. 🗑️ボタンをクリック → 赤背景＋✓アイコンに変化
3. もう一度クリック → 削除実行

## 実装ファイル

| ファイル | 役割 |
|----------|------|
| `lib/utils/presets.ts` | CRUD操作 |
| `lib/constants/storage.ts` | ストレージキー |
| `components/FilterPanel.tsx` | UI |
| `styles/components/filter-panel.css` | スタイル |
| `types/index.ts` | FilterPreset型 |
