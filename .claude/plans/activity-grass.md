# アクティビティグラフ（草）機能計画

## 概要

GitHubの草（Contribution Graph）のような投稿アクティビティ表示。
投稿の継続を可視化し、皆勤賞的な達成感を提供。

## 表示イメージ

```
┌─ アクティビティ ─────────────────────────────────┐
│                                                  │
│  1月  2月  3月  4月  5月  6月  7月  8月          │
│ ┌──────────────────────────────────────────────┐ │
│ │░░▓▓░░░░▓▓▓░░░░▓▓▓▓░░░░▓▓▓▓▓░░░▓▓▓▓▓▓░▓▓▓▓▓▓│ │
│ │░▓▓▓░░░▓▓▓▓░░░▓▓▓▓▓░░░▓▓▓▓▓▓░░▓▓▓▓▓▓▓░▓▓▓▓▓▓│ │
│ │▓▓▓▓░░▓▓▓▓▓░░▓▓▓▓▓▓░░▓▓▓▓▓▓▓░▓▓▓▓▓▓▓▓░▓▓▓▓▓▓│ │
│ │▓▓▓▓░▓▓▓▓▓▓░▓▓▓▓▓▓▓░▓▓▓▓▓▓▓▓░▓▓▓▓▓▓▓▓░▓▓▓▓▓▓│ │
│ │░▓▓▓░░▓▓▓▓░░░▓▓▓▓▓░░░▓▓▓▓▓▓░░▓▓▓▓▓▓▓░▓▓▓▓▓▓▓│ │
│ │░░▓▓░░░▓▓▓░░░░▓▓▓▓░░░░▓▓▓▓▓░░░▓▓▓▓▓▓░░▓▓▓▓▓▓│ │
│ │░░░▓░░░░▓▓░░░░░▓▓▓░░░░░▓▓▓▓░░░░▓▓▓▓▓░░░▓▓▓▓▓│ │
│ └──────────────────────────────────────────────┘ │
│ 日 月 火 水 木 金 土                              │
│                                                  │
│ 少ない ░░▒▒▓▓██ 多い                            │
│                                                  │
│ 🔥 現在の連続投稿: 42日                          │
│ 🏆 最長連続投稿: 89日                            │
│ 📝 今年の投稿数: 234                             │
└──────────────────────────────────────────────────┘
```

## データ取得

### 投稿履歴の集計

```typescript
interface ActivityData {
  date: string       // "2025-01-15"
  count: number      // その日の投稿数
}

async function fetchActivityData(pubkey: string, year: number): Promise<ActivityData[]> {
  // Kind 1 イベントを取得
  // created_at から日付を抽出
  // 日別に集計
}
```

### 集計対象

| 種類 | カウント |
|------|---------|
| 通常投稿 (Kind 1) | ✓ |
| リプライ | ✓ または オプション |
| リポスト | ✗ |
| いいね | ✗ |

## 草の色段階

```css
.activity-0 { background: var(--grass-empty); }    /* 0件: 空 */
.activity-1 { background: var(--grass-level-1); }  /* 1件 */
.activity-2 { background: var(--grass-level-2); }  /* 2-3件 */
.activity-3 { background: var(--grass-level-3); }  /* 4-6件 */
.activity-4 { background: var(--grass-level-4); }  /* 7件以上 */
```

### テーマ対応

| テーマ | 色 |
|--------|-----|
| デフォルト | 緑系（GitHub風） |
| mypace | 虹色グラデーション |
| カスタム | ユーザーの4隅色を使用 |

## 統計表示

### 基本統計

- 🔥 **現在の連続投稿**: 今日まで何日連続か
- 🏆 **最長連続投稿**: 過去最長の連続日数
- 📝 **今年の投稿数**: 年間総投稿数
- 📅 **投稿日数**: 1回でも投稿した日の数

### 達成バッジ

```
┌─ バッジ ─────────────────────────┐
│ 🌱 初投稿        ✓               │
│ 🌿 7日連続       ✓               │
│ 🌳 30日連続      ✓               │
│ 🎋 100日連続     ○               │
│ 💯 年間100投稿   ✓               │
│ 🔥 年間365投稿   ○               │
└──────────────────────────────────┘
```

## 実装

### Reactコンポーネント

```tsx
interface ActivityGraphProps {
  pubkey: string
  year?: number
}

function ActivityGraph({ pubkey, year = new Date().getFullYear() }: ActivityGraphProps) {
  const [data, setData] = useState<ActivityData[]>([])

  useEffect(() => {
    fetchActivityData(pubkey, year).then(setData)
  }, [pubkey, year])

  // 週ごとに分割（GitHub風レイアウト）
  const weeks = groupByWeek(data)

  return (
    <div className="activity-graph">
      <div className="activity-months">
        {/* 月ラベル */}
      </div>
      <div className="activity-grid">
        <div className="activity-days">
          {/* 曜日ラベル */}
        </div>
        <div className="activity-cells">
          {weeks.map((week, i) => (
            <div key={i} className="activity-week">
              {week.map((day, j) => (
                <div
                  key={j}
                  className={`activity-cell activity-${getLevel(day.count)}`}
                  title={`${day.date}: ${day.count}件`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="activity-legend">
        少ない
        {[0, 1, 2, 3, 4].map(l => (
          <div key={l} className={`activity-cell activity-${l}`} />
        ))}
        多い
      </div>
    </div>
  )
}
```

### CSS

```css
.activity-graph {
  font-size: 0.75rem;
}

.activity-grid {
  display: flex;
  gap: 2px;
}

.activity-week {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.activity-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.activity-0 { background: #ebedf0; }
.activity-1 { background: #9be9a8; }
.activity-2 { background: #40c463; }
.activity-3 { background: #30a14e; }
.activity-4 { background: #216e39; }

/* ダークテーマ */
.dark-theme .activity-0 { background: #161b22; }
.dark-theme .activity-1 { background: #0e4429; }
.dark-theme .activity-2 { background: #006d32; }
.dark-theme .activity-3 { background: #26a641; }
.dark-theme .activity-4 { background: #39d353; }
```

## 配置場所

### プロフィールページ

```
┌─ プロフィール ──────────────────────────┐
│ [アバター] @username                   │
│ 自己紹介...                            │
│                                        │
│ ─────────────────────────────────────  │
│                                        │
│ [アクティビティグラフ]                  │
│                                        │
│ 🔥 42日連続  📝 234投稿                │
│                                        │
│ ─────────────────────────────────────  │
│                                        │
│ [投稿一覧]                             │
└────────────────────────────────────────┘
```

## パフォーマンス考慮

### キャッシュ

- 1日単位でキャッシュ
- 今日のデータのみリアルタイム更新
- 過去データはAPIキャッシュ活用

### 遅延読み込み

- プロフィールページ表示時に非同期取得
- スケルトンUIでローディング表示

## 拡張案

### 3Dグラフ表示（デスノート風）

映画「デスノート」でLがキラの行動時間を分析した3Dグラフのような表示。

```
        ┌─────────────────────────┐
       ╱                         ╱│
      ╱    ▓▓▓                  ╱ │
     ╱   ▓▓▓▓▓▓    ▓▓         ╱  │
    ╱  ▓▓▓▓▓▓▓▓▓  ▓▓▓▓       ╱   │  ← 投稿数
   ╱ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓     ╱    │
  ├─────────────────────────┤    │
  │                         │    │
  │  月 火 水 木 金 土 日    │   ╱  ← 曜日
  │                         │  ╱
  │  0  6  12 18 24        │ ╱   ← 時間帯
  └─────────────────────────┘╱
```

**特徴:**
- X軸: 曜日
- Y軸: 時間帯（0-24時）
- Z軸: 投稿数
- 回転・ズーム可能
- 「学生か社会人か」「夜型か朝型か」が一目でわかる

**別プロダクトとして実装:**
- ライブラリ名: `3d-activity-viz` (仮)
- 技術: Three.js / WebGL
- mypaceに埋め込み可能なコンポーネントとして提供
- 他のプロジェクトでも使えるよう汎用的に

**埋め込み:**
```tsx
import { Activity3DGraph } from '3d-activity-viz'

<Activity3DGraph
  data={activityData}
  theme="mypace"
  interactive={true}
/>
```

**切り替えUI:**
```
[2D草グラフ] [3Dグラフ]
     ○          ●
```

### ヒートマップ以外の表示

- **折れ線グラフ**: 投稿数の推移
- **カレンダー表示**: 月別カレンダーで表示
- **円グラフ**: 曜日別・時間帯別の投稿傾向

### ソーシャル機能

- 連続投稿ランキング
- 「○○日連続投稿達成！」の自動投稿
- フレンドとの比較

## 実装優先度

1. 基本グラフ表示
2. 統計（連続日数、投稿数）
3. プロフィールページ配置
4. テーマ対応
5. 達成バッジ
6. ランキング・ソーシャル機能
