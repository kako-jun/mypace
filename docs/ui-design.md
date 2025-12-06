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

## Post Form

- プレースホルダー: 「マイペースに書こう」
- 文字数制限: 4200文字
- Previewボタン: Markdown/画像URL/リンクの表示確認
- プレビューには自分のテーマカラーが適用される

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
- Window Color: 4隅カラーカスタマイズ
- Your Keys: npub/nsec表示、コピー機能
  - nsecはデフォルト非表示（Show/Hideで切り替え）
- Import Key: nsecインポート
  - インポート時に既存設定（プロフィール、テーマ）をクリア
- Danger Zone: キー削除

## Window Color (パーソナルカラー)

PS1 FF7のウィンドウカラーカスタマイズにインスパイアされた機能。

### 概要
- 4隅の色を指定し、中央でなめらかにブレンドするグラデーション背景
- **ページ全体の背景** と **自分の投稿カードの背景** の両方に適用
- 他のユーザーからも、その人の投稿カードとして色が見える

### UI
- プレビューエリア内に4つの円形カラーピッカーを配置
- Enable チェックボックスで有効/無効を切り替え
- Apply ボタンで保存、Reset ボタンでデフォルトに戻す

### グラデーション生成
```css
radial-gradient(ellipse at top left, color1 0%, transparent 50%),
radial-gradient(ellipse at top right, color2 0%, transparent 50%),
radial-gradient(ellipse at bottom left, color3 0%, transparent 50%),
radial-gradient(ellipse at bottom right, color4 0%, transparent 50%),
linear-gradient(135deg, color1 0%, color4 100%)
```

### 自動テキスト色調整
- 左上の色の明度を計算（WCAG準拠の相対輝度）
- 暗い背景（輝度 < 0.4）→ 白文字
- 明るい背景 → 黒文字
- ロゴ、Settingsボタン、投稿カードのテキストに適用

### Nostrタグ
投稿時にテーマカラーをイベントタグとして埋め込み:
```
['mypace_theme', '#0a1628', '#1a3a5c', '#1a3a5c', '#0a1628']
```
- 本文のハッシュタグとは別（tags配列のメタデータ）
- 他のNostrクライアントでは無視される
- mypaceでのみグラデーションカードとして表示

### デフォルト色
テーマ無効時の背景色と同じ白系:
| 位置 | 色 |
|------|-----|
| 全て | `#f8f8f8` |

### プリセット: FF7風ブルー
| 位置 | 色 |
|------|-----|
| 左上 | `#0a1628` |
| 右上 | `#1a3a5c` |
| 左下 | `#1a3a5c` |
| 右下 | `#0a1628` |

### オーバースクロール対応
スマホで上下に引っ張った時も背景色が見えるよう、`html`要素にもテーマ色を適用。

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

## Markdown & Code Highlighting

プログラマー向け機能として、投稿内容はMarkdownとしてパースされる:

### 改行の扱い
- 単一の改行も`<br>`として反映される（`breaks: true`）
- 一般ユーザーの期待通りに表示される

### 対応Markdown記法
- **見出し**: `# H1`, `## H2`, `### H3`
- **太字/斜体**: `**bold**`, `*italic*`
- **リスト**: `- item` / `1. item`
- **引用**: `> quote`
- **リンク**: `[text](url)`
- **インラインコード**: `` `code` ``
- **コードブロック**: ` ```lang ... ``` `

### シンタックスハイライト (Prism.js)
コードブロックは言語指定でシンタックスハイライト:

対応言語:
- JavaScript / TypeScript / JSX / TSX
- Python / Rust / Go
- CSS / JSON / YAML
- Bash / SQL / Markdown

### コードブロックスタイル
- VS Code風ダークテーマ
- 背景: `#1e1e1e`
- フォント: `JetBrains Mono`, `Fira Code` 等のコード用フォント
- 横スクロール対応

### インラインコードスタイル
- 背景: `#f0f0f0`
- テキスト: `#c7254e` (ピンク系)
- 角丸: `3px`
