# My Stats Widget（自分の統計ウィジェット）

ホーム画面の右下に自分の統計情報を常時表示するフローティングウィジェット。

## 概要

| 項目 | 内容 |
|------|------|
| 表示ページ | ホームページのみ |
| 表示位置 | 画面右下（固定） |
| 表示内容 | posts数、views（詳細/印象）、stella数 |
| 配置 | 縦並び、右寄せ |
| 表示条件 | ユーザー名（プロフィール）設定済みの場合のみ |

## 仕様

### 表示条件

1. **nsecが存在する**（ログイン済み）
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
- **stella**: 獲得ステラ数（黄色で表示）

### スタイル

| 項目 | 値 |
|------|-----|
| フォント | ユーザーページの統計表示と同じ |
| 文字配置 | 右寄せ |
| 位置 | `position: fixed; right: 16px; bottom: 16px;` |
| 背景（ライト） | `rgba(255, 255, 255, 0.5)` |
| 背景（ダーク） | `rgba(0, 0, 0, 0.5)` |

### レスポンシブ対応

`clamp()` を使用して画面幅に応じて緩やかに縮小：

| 項目 | 最小 | 最大 |
|------|------|------|
| フォントサイズ | 1.1rem | 1.5rem |
| パディング | 6px 8px | 8px 12px |
| アイコンサイズ | 12px | 14px |

### z-index

投稿エディタとの重なりを考慮した優先順位：

```
投稿エディタ（最前面, z-index: 1050）
    ↓
スタッツウィジェット（z-index: 30）
    ↓
タイムライン投稿カード（z-index: 1-20）
```

**注意**: スタッキングコンテキストの問題を避けるため、ウィジェットは `HomePage.tsx` 内で `PostForm` と同じ Fragment 内に配置する必要がある。

### 動作

| 項目 | 内容 |
|------|------|
| クリック | なし（`pointer-events: none`） |
| 更新間隔 | 初回取得 + 60秒間隔で自動更新 |
| モバイル | 表示する（レスポンシブで縮小） |

## ファイル構成

```
apps/web/src/
├── pages/
│   └── HomePage.tsx            # ウィジェットを組み込み
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

### データの性質

| 項目 | 元記事削除時 |
|------|------------|
| posts | 減る（Primal cache参照） |
| stella | 減る（user_stellaテーブルから削除） |
| views | **減らない**（event_viewsテーブルは削除されない） |

## 関連ドキュメント

- [view-count.md](./view-count.md) - 閲覧数の仕様
- [stella.md](./stella.md) - ステラの仕様

---

[← 拡張一覧に戻る](./index.md)
