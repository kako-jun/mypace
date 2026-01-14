# MY PACE独自拡張（技術仕様）

MY PACEはNostrプロトコルの拡張性を活用し、独自機能を実装しています。
これらの拡張はNostrのタグ構造に従っており、他のクライアントに影響を与えません。

> **ユーザー向けドキュメント**: 各機能の使い方は [ユーザーガイド](../../user-guide/) を参照してください。

## 設計思想

- **クライアント側で完結**: すべてのタグはクライアント側で追加・署名
- **サーバーは透過的**: APIは署名済みイベントをそのままリレーに転送
- **後方互換性**: 他のNostrクライアントはタグを無視するだけで正常動作
- **将来の採用を考慮**: 他クライアントでも実装可能な仕様

## 拡張一覧

### Nostrタグ拡張

| タグ名 | ドキュメント | 概要 |
|--------|-------------|------|
| `stella` | [stella.md](./stella.md) | 1投稿に最大10ステラ |
| `pinned` | [pinned-post.md](./pinned-post.md) | プロフィール先頭固定投稿 |

### プロフィール拡張

| フィールド | ドキュメント | 概要 |
|-----------|-------------|------|
| `websites` | [websites.md](./websites.md) | 複数サイトURLをプロフィールに登録 |

### API

| 拡張 | ドキュメント | 概要 |
|------|-------------|------|
| Webhook API | [webhook-api.md](./webhook-api.md) | 外部からの投稿API |
| Dynamic OGP | [dynamic-ogp.md](./dynamic-ogp.md) | 動的OGP生成 |
| Intent Share | [intent-share.md](./intent-share.md) | 外部サイトから投稿画面へテキスト渡し |
| View Count | [view-count.md](./view-count.md) | 閲覧数（インプレッション/詳細）トラッキング |

### インフラ

| 機能 | ドキュメント | 概要 |
|------|-------------|------|
| 404 | [404.md](./404.md) | 存在しないルートのフォールバック |
| Embed | [embed.md](./embed.md) | Web Components埋め込みカード |
| User Serial | [user-serial.md](./user-serial.md) | 参加順の通し番号 |

### フィルタ設計

| 機能 | ドキュメント | 概要 |
|------|-------------|------|
| Filter Overview | [filter-overview.md](./filter-overview.md) | フィルタ機能の全体設計 |

### 廃止機能

| 機能 | ドキュメント | 概要 |
|------|-------------|------|
| Teaser | [teaser.md](./teaser.md) | 280文字超の折りたたみ（廃止） |

## データフロー

```
[クライアント]
    │
    │ 1. イベント作成（独自タグ含む）
    │ 2. 秘密鍵で署名
    │
    ▼
[MY PACE API] (/api/publish)
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

署名済みイベントを作成できるツールであれば、MY PACE APIを通じて投稿可能です。

- **nostr-tools** (JavaScript/TypeScript)
- **python-nostr** (Python)
- **nostr-rs** (Rust)
- **その他のNostrライブラリ**

詳細は [webhook-api.md](./webhook-api.md) を参照。

---

[← 開発者向けドキュメントに戻る](../index.md)
