# 埋め込みカード（Web Components）

外部サイトにMY PACEの投稿カードを埋め込む機能。

## 概要

`<mypace-card>` カスタム要素を提供し、任意のウェブサイトに投稿カードを表示できる。内部的にはiframeを使用し、既存のReactコンポーネントを再利用するため、MY PACE上のカードと同一の見た目になる。

## 使用方法

```html
<!-- スクリプトを読み込み -->
<script src="https://mypace.llll-ll.com/embed.js"></script>

<!-- 特定の投稿をノートIDで指定 -->
<mypace-card note="note1abc..."></mypace-card>

<!-- 最新の投稿 -->
<mypace-card latest></mypace-card>

<!-- 特定ユーザーの最新投稿 -->
<mypace-card latest pubkey="npub1..."></mypace-card>
```

## 属性

| 属性 | 説明 |
|------|------|
| `note` | 表示するノートID（note1... または hex） |
| `latest` | 最新の投稿を表示（値不要） |
| `pubkey` | 最新投稿をフィルタするユーザー公開鍵（npub1... または hex） |
| `theme` | `light` または `dark`（デフォルト: `light`） |

## スタイリング

デフォルト: `max-width: 500px; display: block;`

`style` 属性で上書き可能:
```html
<mypace-card note="..." style="max-width: 400px;"></mypace-card>
<mypace-card note="..." style="max-width: 100%;"></mypace-card>
```

## アーキテクチャ

```
外部サイト
    │
    ├─ <script src="https://mypace.llll-ll.com/embed.js">
    │
    └─ <mypace-card note="...">
           │
           │ connectedCallback()
           ▼
       <iframe src="https://mypace.llll-ll.com/embed/note1...">
           │
           ▼
       EmbedPage.tsx (React)
           │
           ▼
       既存コンポーネント: PostHeader, PostContent, PostStickers など
```

## カードの表示内容

埋め込みカードに表示されるもの:
- アバター（黒縁白文字の名前）
- 投稿本文（スーパーメンション含む）
- ステッカー（オリジナルと同じ位置）
- 4隅グラデーション（mypaceテーマ）
- タイムスタンプ

**含まれないもの:**
- リアクションボタン（いいね、返信、リポスト）
- 編集・削除ボタン

**クリック動作:**
カードのどこをクリックしても、mypace.llll-ll.com の投稿詳細ページが新しいタブで開く。

## 実装

### ファイル

| ファイル | 場所 | 役割 |
|----------|------|------|
| `embed.js` | `apps/web/public/` | Web Component（iframe生成） |
| `EmbedPage.tsx` | `apps/web/src/pages/` | 既存コンポーネントを使用した埋め込みページ |
| `embed-card.css` | `apps/web/src/styles/components/` | 埋め込み専用スタイル |

### Web Component (embed.js)

```javascript
class MypaceCard extends HTMLElement {
  connectedCallback() {
    const noteId = this.getAttribute('note')
    const isLatest = this.hasAttribute('latest')
    const theme = this.getAttribute('theme') || 'light'

    // デフォルトスタイル（上書き可能）
    if (!this.style.display) this.style.display = 'block'
    if (!this.style.maxWidth) this.style.maxWidth = '500px'

    const src = isLatest
      ? `https://mypace.llll-ll.com/embed/latest?theme=${theme}`
      : `https://mypace.llll-ll.com/embed/${noteId}?theme=${theme}`

    const iframe = document.createElement('iframe')
    iframe.src = src
    iframe.style.cssText = 'border:none; width:100%; min-height:200px;'
    this.appendChild(iframe)

    // 高さはiframeからのpostMessageで自動調整
  }
}

customElements.define('mypace-card', MypaceCard)
```

### ルーティング

```
/embed/:noteId → EmbedPage
```

## スタイル

埋め込みページ:
- 既存のpost-card.cssを使用
- カード幅は外側のコンテナに従う（内部のmax-width制約なし）
- ホバーエフェクトを削除（ホバー時のdrop-shadowなし）
- カード全体がクリック可能
- クエリパラメータでライト/ダークテーマをサポート
