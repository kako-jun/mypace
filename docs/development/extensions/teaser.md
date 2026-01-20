# teaser（長文フォールド / ステラ必須）

280文字を超える投稿を折りたたみ、他のNostrクライアントのタイムラインを圧迫しない仕組み。
オプションでステラ必須（続きを読むにはステラが必要）を設定可能。

## 背景

- SNSのタイムラインに長文が流れると迷惑になる
- しかし「じっくり書きたい」ニーズもある
- Kind 30023（長文記事）は対応クライアントが少ない
- ステラ必須記事で収益化したいニーズもある

## 解決策

Kind 1のまま、本文を分割してタグに格納する。
第3要素でステラの色を指定可能。

## タグ形式

```json
["teaser", "<続きの本文>"]           // 通常の折りたたみ（誰でも展開可能）
["teaser", "<続きの本文>", "blue"]   // ステラ必須（ブルーステラで展開可能）
```

### 指定可能な色

| 色 | 値 | 必要なステラ |
|----|-----|-------------|
| イエロー | `yellow` | 無料（練習用） |
| グリーン | `green` | 1 sat |
| レッド | `red` | 10 sats |
| ブルー | `blue` | 100 sats |
| パープル | `purple` | 1,000 sats |

## 投稿時の処理

### 通常の折りたたみ（280文字超）

```json
{
  "kind": 1,
  "content": "最初の280文字...\n\n...READ MORE → https://mypace.llll-ll.com/user/{npub}",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["teaser", "281文字目以降の本文すべて"]
  ]
}
```

### ステラ必須設定時

```json
{
  "kind": 1,
  "content": "最初の280文字...\n\n...READ MORE → https://mypace.llll-ll.com/user/{npub}",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["teaser", "281文字目以降の本文すべて", "blue"]
  ]
}
```

### 投稿時の安全処理

- 280文字以下の投稿にはteaserタグを付けない（ステラ必須設定されていても無視）
- エディタでは281文字超の場合のみティーザー設定UIを表示

## 閾値

**280文字**（Twitter/X基準）

この値は以下で共通:
1. 投稿時のteaser分割
2. エディタの「折りたたまれます」警告
3. エディタのティーザー設定ボタン表示条件
4. 他クライアント投稿のGUI側切り詰め

## 表示ロジック

### タイムライン

```typescript
if (hasTeaserTag(event)) {
  // contentをそのまま表示（既に280字+リンク）
  // ステラ必須の場合は錠前アイコンを表示
} else if (content.length > 280) {
  // GUI側で切り詰め + READ MORE
} else {
  // そのまま表示
}
```

### 個別ページ / 展開時

```typescript
function canExpandTeaser(event: NostrEvent, currentUserPubkey: string): boolean {
  // 投稿者自身は常に展開可能
  if (event.pubkey === currentUserPubkey) {
    return true
  }

  const teaserTag = event.tags.find(t => t[0] === 'teaser')
  if (!teaserTag) return true  // teaserタグなし = 展開不要

  const requiredColor = teaserTag[2]  // 第3要素
  if (!requiredColor) return true  // 色指定なし = 誰でも展開可能

  // 指定色のステラを付けているかチェック
  return hasGivenStella(event.id, currentUserPubkey, requiredColor)
}

function getFullContent(event: NostrEvent): string {
  const teaserTag = event.tags.find(t => t[0] === 'teaser')
  if (!teaserTag) return event.content

  const teaserContent = teaserTag[1]
  const baseContent = removeReadMoreLink(event.content)
  return baseContent + teaserContent
}
```

## アンロック条件

| 条件 | 展開可否 |
|------|---------|
| 投稿者自身 | 常に可能 |
| 色指定なし（通常teaser） | 誰でも可能 |
| 色指定あり + 指定色のステラを付けた | 可能 |
| 色指定あり + ステラなし or 別の色 | 不可 |

### 重要なルール

- **色は完全一致が必要**: ブルー必須の投稿にグリーンを付けてもアンロックされない
- **一度アンロックしたら永久に読める**: ステラを付けた履歴で判定
- **厳密なDRMではない**: デベロッパーツールで読める可能性はある（許容）

## ティーザーUI

### エディタ

281文字超の場合、ツールバーに錠前ボタンが表示される:

```
┌─ ツールバー ─────────────────────────────┐
│ [画像] [お絵かき] [音声] [位置] [🔒]     │
└─────────────────────────────────────────┘
```

錠前ボタンをクリックすると、画面中央にピッカーが表示される:

```
┌─ Teaser ─────────────────────── [×] ─┐
│                                       │
│  Readers need to give a stella        │
│  to read more                         │
│                                       │
│     ★   ★   ★   ★   ★               │
│    黄  緑  赤  青  紫                 │
│                                       │
│           [Clear]                     │
└───────────────────────────────────────┘
```

- 5色の星が横並びで表示
- ラベルや価格は表示しない
- 選択中の星は枠線でハイライト
- 再度クリックで選択解除

### タイムライン表示

```
┌─ 投稿（ブルーステラ必須）───────────────┐
│ @username                              │
│                                        │
│ Today I'll share a special recipe.     │
│ First, the ingredients...              │
│                                        │
│ … READ MORE 🔒                         │
│         (blue lock icon)               │
└────────────────────────────────────────┘
```

### 個別ページ（ロック状態）

```
┌─ 投稿詳細 ──────────────────────────────┐
│ @username                              │
│                                        │
│ Today I'll share a special recipe.     │
│ First, the ingredients...              │
│                                        │
│ … READ MORE 🔒 Requires Blue Stella    │
│                                        │
└────────────────────────────────────────┘
```

- タイムラインと同じスタイルで「… READ MORE」+ 錠前アイコン
- 右側に「Requires {color} Stella」と必要なステラ色を表示

## READ MOREリンク

リンク先はユーザーページ（`/user/{npub}`）。

**理由**: イベントIDは署名前に確定できない（ハッシュが内容に依存するため）。
プロフィールページからなら該当投稿を見つけられる。

## 返信ツリーでの表示

投稿詳細ページの返信一覧でも、各返信は折りたたみ表示される。

- 長文返信は280文字で切り詰め + READ MORE
- teaser付き返信もタイムラインと同様に折りたたみ
- ステラ必須の返信は錠前アイコン表示
- READ MOREをクリックすると該当返信の詳細ページへ遷移

## 他クライアントでの表示

- `content` 部分（280字+リンク）のみ表示される
- `teaser` タグは無視される
- READ MOREリンクをクリックするとMY PACEで全文を読める
- **ステラ必須設定されていても、他クライアントでは280字までしか見えない**

## 編集時の挙動

投稿の編集は「削除 + 新規投稿」として扱われる。

- IDが変わる
- アンロック済みの状態はリセットされる
- ティーザー設定も自由に変更可能
