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

- 左下に固定配置
- プレースホルダー: 「マイペースに書こう」
- 文字数制限: 4200文字
- Previewボタン: Markdown/画像URL/リンクの表示確認
- プレビューには自分のテーマカラーが適用される

### 長文モード
- 右上の「Long mode」ボタンで切り替え（長文モード時は左下固定に移動）
- PC（961px以上）: 左右2カラム（エディタ左、プレビュー右）
- スマホ/タブレット（960px以下）: 上下2分割（エディタ上、プレビュー下）
- Previewボタンでプレビューのオン/オフを切り替え可能
- タイムラインは非表示になり、画面全幅を使用
- 「Short mode」で通常モードに戻る（プレビューも自動オフ）

## Feedback Messages

操作成功時はインラインで緑色メッセージを2秒間表示:
- プロフィール更新: `Updated!`
- 投稿編集保存: `Saved!`
- 投稿削除: `Deleted!`

## Post Actions

### いいね（NIP-25 kind 7）
- 星アイコン（☆/★）でいいね操作
- 自分の投稿にはいいね不可（ボタン非表示、カウントのみ表示）
- いいね済みは金色の★で表示

### 返信（NIP-10）
- 返信ボタンで投稿フォームが返信モードに切り替わる
- 「Replying to post...」ラベル表示、緑枠
- スレッド形式で返信を表示（インデント付き）
- 自分への返信も可能

### リポスト（NIP-18 kind 6）
- リポストボタンで再投稿
- タイムラインに「🔁 ○○ reposted」ラベル付きで表示
- 元の投稿とリポストは両方タイムラインに表示される
- 自分の投稿もリポスト可能

### 編集・削除
- 自分の投稿のみ「Edit」「Delete」ボタン表示（右下寄せ）
- Edit押下で投稿フォームに内容を読み込み編集モードへ
- 編集モード: 投稿フォームに「Editing post...」ラベル表示、青枠
- 返信の編集時は返信タグを保持（NIP-10 e/pタグ）
- Delete押下で確認UI表示（ブラウザアラート不使用）
  - `Delete? Yes No` のインライン確認（投稿カード内）
- 編集は delete + 新規投稿の2ステップ（Nostr仕様）

## RESTful URLs

静的URLでタイムラインの状態を共有可能:

| URL | 内容 |
|-----|------|
| `/` | タイムライン（全投稿） |
| `/post/{event_id}` | 個別投稿ページ（大きめカード表示） |
| `/tag/{hashtag}` | ハッシュタグフィルタ |

### 個別投稿ページ
- 投稿カードクリックで遷移（ボタン・リンク以外の領域）
- 大きめカードで全文表示
- テーマカラー背景適用
- 返信一覧表示

### 長文の折りたたみ
- タイムライン上では420文字または42行を超える投稿は省略
- 「...続きを読む」表示
- クリックで個別投稿ページへ遷移して全文表示

## Settings Panel

右からスライドで開くパネル。パネル外クリックで閉じる。

- Profile: 名前変更
- App Theme: ライト/ダークテーマ切り替え
- Window Color: 4隅カラーカスタマイズ（即時保存）
- Your Keys: npub/nsec表示、コピー機能
  - nsecはデフォルト非表示（Show/Hideで切り替え）
- Import Key: nsecインポート
  - インポート時に既存設定（プロフィール、テーマ）をクリア
- Danger Zone: キー削除
- GitHub: リポジトリへのリンク（フッター）

パネル開閉時にbodyのスクロールを無効化（二重スクロールバー防止）。

## App Theme (ライト/ダーク)

アプリ全体のUIテーマ。Window Color（背景）とは独立。

### ライトテーマ（デフォルト）
- 投稿フォーム背景: `#fff`
- 入力欄背景: `#f5f5f5`
- テキスト: `#333`
- ボタン: 黒背景白文字

### ダークテーマ
- 投稿フォーム背景: `#1a1a1a`
- 入力欄背景: `#333`
- テキスト: `#e0e0e0`
- ボタン: 白背景黒文字（反転）

### 適用範囲
- Settingsパネル
- 投稿フォーム
- プロフィール設定フォーム
- ボタン類

### 適用されない要素
- ページ背景（Window Colorで制御）
- 投稿カード（各ユーザーのテーマカラー）

## Window Color (パーソナルカラー)

PS1 FF7のウィンドウカラーカスタマイズにインスパイアされた機能。

### 概要
- 4隅の色を指定し、中央でなめらかにブレンドするグラデーション背景
- **ページ全体の背景** と **自分の投稿カードの背景** の両方に適用
- 他のユーザーからも、その人の投稿カードとして色が見える

### UI
- プレビューエリア内に4つの円形カラーピッカーを配置
- 常に有効（Enable チェックボックスは廃止）
- 色変更時に即時保存・即時反映（Apply/Resetボタンなし）

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
- 複数タグのAND/OR絞り込みに対応
- タイムライン上部にフィルターバー表示
- 各タグは個別に削除可能（`×`ボタン）
- AND/ORボタンでモードを切り替え
- 「Clear all」で全フィルター解除
- ロゴクリックでもホームに戻る
- mypaceタグ付き投稿の中からさらに絞り込み

### 複数タグフィルタURL

| URL | 意味 |
|-----|------|
| `/tag/javascript` | javascriptタグのみ |
| `/tag/javascript+react` | javascript AND react |
| `/tag/javascript,react` | javascript OR react |

### 操作

1. ハッシュタグをクリック → フィルター追加（既存フィルターがあれば追加）
2. AND/ORボタンをクリック → モード切り替え（URL更新）
3. タグの×ボタン → そのタグのみ解除
4. 「Clear all」 → 全解除してホームに戻る

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
