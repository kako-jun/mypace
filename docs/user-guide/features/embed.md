# 埋め込み

外部サービスのコンテンツをタイムラインに表示する機能です。

## 対応サービス

| サービス | 例 |
|---------|-----|
| YouTube | 動画、Shorts |
| Twitter/X | ツイート |
| Instagram | 投稿 |
| TikTok | 動画 |
| Spotify | トラック、アルバム、プレイリスト |

## 使い方

投稿にURLを含めるだけで、自動的に埋め込み表示されます。

```
この曲おすすめ！
https://open.spotify.com/track/xxx

#mypace
```

## 画像の自動展開

画像URLは本文中にインラインで表示されます。

- `.jpg`, `.png`, `.gif`, `.webp`, `.svg` で終わるURL
- パスに `image`, `img`, `photo` 等を含むURL（例: `/api/article-image?id=5`）

後者は画像でなかった場合、通常のリンクとして表示されます。

## OGPプレビュー

対応サービス以外のURLも、OGP情報（タイトル・画像）がプレビュー表示されます。

---

[← 便利な機能に戻る](./index.md)
