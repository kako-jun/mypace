# UI Design Philosophy

## Core Principles

### 1. 枠を意識させない (Borderless)
- 枠線や囲みは一切使わない
- 色の違いのみで領域を区別
- 背景色: `#f8f8f8` (ベース) → `#fff` (カード)

### 2. 滑らかな遷移 (Seamless Transitions)
- View Transitions API でページ遷移をアニメーション化
- ユーザーに「遷移した」と感じさせない
- FF4のメニュー画面のように自然にカードが移動

### 3. 軽量・高速 (Lightweight)
- Google Fonts は1種類のみ (M PLUS Rounded 1c)
- システムフォントをフォールバック
- 最小限のCSS

## Typography

| 用途 | フォント | Weight |
|------|---------|--------|
| ロゴ | M PLUS Rounded 1c | 900 (Black) |
| 本文 | M PLUS Rounded 1c | 400 (Regular) |
| UI | M PLUS Rounded 1c | 400-700 |

### ロゴ
```
MY
PACE
```
- 2行、左詰め
- 極太ゴシック (weight: 900)
- どのブラウザでも同じ見た目

## Colors

| Element | Color |
|---------|-------|
| Background | `#f8f8f8` |
| Card | `#fff` |
| Text | `#333` / `#444` |
| Muted | `#888` / `#aaa` / `#bbb` |
| Logo MY | `#222` |
| Logo PACE | `#444` |
| Button | `#333` |
| Error | `#c44` |

## Animation

### Card Appearance
- フェードイン + 上方向から移動
- スタガー効果 (順番に出現)
- `animation-delay`: 0s, 0.03s, 0.06s...

### Hover
- カードが右に微妙に移動 (`translateX(4px)`)
- 背景色が微妙に変化

### Page Transition
- View Transitions API
- フェードアウト (上に移動) → フェードイン (下から移動)
- Duration: 0.3s

## Interaction

- フォーカス時にフォームが浮き上がる (box-shadow)
- ボタンは押すと縮む (`scale(0.98)`)
- 設定パネルはスライドで開く
- ロゴクリックでトップへ遷移（選択不可）

## Feedback Messages

操作成功時はインラインで緑色メッセージを2秒間表示:
- プロフィール更新: `Updated!`
- 投稿編集保存: `Saved!`
- 投稿削除: `Deleted!`

## Post Actions

自分の投稿のみ「Edit」ボタン表示:
- Edit押下で編集モードへ
- 編集モード: textarea + Delete / Cancel / Save
- Delete押下で確認UI表示（ブラウザアラート不使用）
  - `Delete? Yes No` のインライン確認
- 編集は delete + 新規投稿の2ステップ（Nostr仕様）

## Settings Panel

- Profile: 名前変更
- Your Keys: npub/nsec表示、コピー機能
- Import Key: nsecインポート
- Danger Zone: キー削除

## Content Rendering

投稿内容の自動パース:
- **ハッシュタグ**: 青紫色で表示、クリックでフィルタリング（日本語対応）
- **URL**: 緑色リンク、新しいタブで開く
- **画像URL** (`.jpg`, `.png`, `.gif`, `.webp`, `.svg`): インライン画像表示

## Hashtag Filtering

- ハッシュタグクリックでフィルタリングモード
- タイムライン上部にフィルターバー表示 (`#tag ×`)
- `×` ボタンまたはロゴクリックで解除
- mypaceタグ付き投稿の中からさらに絞り込み
