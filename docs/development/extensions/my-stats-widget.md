# My Stats Widget（自分の統計ウィジェット）

画面右下に自分の統計情報を常時表示するフローティングウィジェット。

## 概要

| 項目 | 内容 |
|------|------|
| 表示位置 | 画面右下（固定） |
| 表示内容 | posts数、views（詳細/印象）、stella数 |
| 配置 | 縦並び、右寄せ |
| 表示条件 | ユーザー名（プロフィール）設定済みの場合のみ |

## 仕様

### 表示条件

1. **npub/nsecが存在する**（ログイン済み）
2. **プロフィールのユーザー名が設定済み**

両方の条件を満たした場合のみウィジェットを表示。

### 表示内容

```
     243 posts
 📊 3 / 52
    ⭐ 99
```

- **posts**: 投稿数
- **views**: 詳細閲覧数 / インプレッション数
- **stella**: 獲得ステラ数

### スタイル

- フォント: ユーザーページの統計表示と同じ
- 文字配置: 右寄せ
- 位置: `position: fixed; right: 16px; bottom: 16px;`

### z-index

投稿エディタとの重なりを考慮した優先順位：

```
投稿エディタ（最前面）
    ↓
スタッツウィジェット
    ↓
タイムライン投稿カード
```

スマホ幅では投稿エディタと同時に表示できる幅がないため、投稿エディタより下に配置。
見にくい場合は投稿カードより下に下げることも検討。

### 動作

- クリック: なし（遷移しない）
- 更新: 初回取得 + 60秒間隔で自動更新
- モバイル: 表示する

## ファイル構成

```
apps/web/src/
├── components/
│   └── stats/
│       └── MyStatsWidget.tsx   # ウィジェットコンポーネント
├── hooks/
│   └── useMyStats.ts           # 統計データ取得フック
└── styles/components/
    └── my-stats-widget.css     # スタイル
```

## データ取得

既存のAPI関数を使用：

| 関数 | エンドポイント | 戻り値 |
|------|---------------|--------|
| `fetchUserPostsCount(pubkey)` | `/api/user/:pubkey/count` | `number` |
| `fetchUserStellaCount(pubkey)` | `/api/user/:pubkey/stella` | `number` |
| `fetchUserViewsCount(pubkey)` | `/api/user/:pubkey/views` | `{ details, impressions }` |

## 関連ドキュメント

- [view-count.md](./view-count.md) - 閲覧数の仕様
- [stella.md](./stella.md) - ステラの仕様

---

[← 拡張一覧に戻る](./index.md)
