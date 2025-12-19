# シール機能テスト用データ

## プレースホルダー画像URL

開発中は以下のプレースホルダー画像を使用:

```
https://via.placeholder.com/150/ff0000/ffffff?text=NEW
https://via.placeholder.com/150/ffff00/000000?text=SALE
https://via.placeholder.com/150/0000ff/ffffff?text=限定
https://via.placeholder.com/150/ff8800/ffffff?text=注目
https://via.placeholder.com/150/00ff00/000000?text=100円引き
```

## テスト用イベントJSON

ブラウザのコンソールで以下を実行してテスト用イベントを作成:

```javascript
// テスト用イベント1: 右上にNEW
{
  "kind": 1,
  "content": "新商品のお知らせです！\n\n今月の新作アイテムをチェックしてください。",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://via.placeholder.com/150/ff0000/ffffff?text=NEW", "85", "5", "20"]
  ]
}

// テスト用イベント2: 複数シール
{
  "kind": 1,
  "content": "特別セール開催中！\n\n期間限定の大特価です。お見逃しなく。",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://via.placeholder.com/150/ffff00/000000?text=SALE", "80", "10", "25"],
    ["sticker", "https://via.placeholder.com/150/0000ff/ffffff?text=限定", "5", "5", "18"]
  ]
}

// テスト用イベント3: 小さめシール
{
  "kind": 1,
  "content": "こちらの商品が話題になっています。\n\nレビューも高評価続出です。",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["sticker", "https://via.placeholder.com/150/ff8800/ffffff?text=注目", "75", "15", "15"]
  ]
}
```

## 手動でイベントを作成する方法

1. mypaceアプリで投稿
2. ブラウザの開発者ツールを開く
3. 投稿イベントのタグに `["sticker", "url", "x", "y", "size"]` を手動で追加
4. 再投稿またはリロード

## 確認ポイント

- [ ] シールが正しい位置に表示される
- [ ] 複数のシールが同時に表示される
- [ ] シールがアニメーションで登場する
- [ ] シールをクリックしても投稿カードがクリックされる（pointer-events: none）
- [ ] PostViewでも同様に表示される
