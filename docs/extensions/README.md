# MyPace独自拡張

MyPaceはNostrプロトコルの拡張性を活用し、独自機能を実装しています。
これらの拡張はNostrのタグ構造に従っており、他のクライアントに影響を与えません。

## 設計思想

- **クライアント側で完結**: すべてのタグはクライアント側で追加・署名
- **サーバーは透過的**: APIは署名済みイベントをそのままリレーに転送
- **後方互換性**: 他のNostrクライアントはタグを無視するだけで正常動作
- **将来の採用を考慮**: 他クライアントでも実装可能な仕様

## 拡張一覧

### Nostrタグ拡張

| 拡張 | ドキュメント | 概要 |
|------|-------------|------|
| テーマカラー | [theme-colors.md](./theme-colors.md) | 投稿カードの4隅グラデーション |
| 長文フォールド | [long-post-fold.md](./long-post-fold.md) | 280文字超の投稿を折りたたみ |
| マルチスター反応 | [multi-star-reaction.md](./multi-star-reaction.md) | 1投稿に最大10スター（ステラ） |

### コンテンツ構文拡張

| 拡張 | ドキュメント | 概要 |
|------|-------------|------|
| アライメント構文 | [alignment-syntax.md](./alignment-syntax.md) | `<<` `>>` `><` `<>` で配置指定 |
| Font構文 | [font-syntax.md](./font-syntax.md) | `<font>` 風の色・サイズ指定 |

### API

| 拡張 | ドキュメント | 概要 |
|------|-------------|------|
| Webhook API | [webhook-api.md](./webhook-api.md) | 外部からの投稿API |

## データフロー

```
[クライアント]
    │
    │ 1. イベント作成（独自タグ含む）
    │ 2. 秘密鍵で署名
    │
    ▼
[MyPace API] (/api/publish)
    │
    │ 3. 署名検証なし（リレーが行う）
    │ 4. そのまま転送
    │
    ▼
[Nostr Relays]
    │
    │ 5. 署名検証
    │ 6. 保存・配信
    │
    ▼
[他のNostrクライアント]
    │
    └─ 独自タグは無視（正常表示）
```

## 外部ツールとの連携

署名済みイベントを作成できるツールであれば、MyPace APIを通じて投稿可能です。

- **nostr-tools** (JavaScript/TypeScript)
- **python-nostr** (Python)
- **nostr-rs** (Rust)
- **その他のNostrライブラリ**

詳細は [webhook-api.md](./webhook-api.md) を参照。
