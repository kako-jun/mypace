# バーコードバトラー機能計画

## 概要

90年代の「バーコードバトラー」をオマージュ。
投稿からバーコードを生成し、バトルできる機能。

## コンセプト

- 各投稿に一意のバーコードが表示される
- バーコードは投稿内容から生成（ランダムではない）
- バーコード同士をバトルさせられる
- じゃんけん的な3すくみの戦闘システム

## バーコード表示

### 投稿カードでの表示

```
┌─ 投稿 ─────────────────────────────────┐
│ @username · 2時間前                    │
│                                        │
│ 今日のランチ美味しかった！              │
│                                        │
│ ★★★★★                      ║│║│║║│ │
│                              ──────── │
│                               ATK 78   │
└────────────────────────────────────────┘
```

### バーコードのサイズ

- 高さ: 20-30px程度（控えめ）
- 幅: 60-80px
- 位置: 投稿カード右下

## ステータス生成アルゴリズム

### 3つのステータス

| ステータス | 略称 | 相性 |
|-----------|------|------|
| ATTACK (攻撃) | ATK | DEFに強い |
| DEFENSE (防御) | DEF | SPDに強い |
| SPEED (速度) | SPD | ATKに強い |

```
    ATK
   ↗   ↘
SPD  ←  DEF

ATK > DEF > SPD > ATK（3すくみ）
```

### 生成ロジック

```typescript
function generateStats(eventId: string, content: string): Stats {
  // イベントIDと内容からハッシュ生成
  const hash = sha256(eventId + content)

  // ハッシュを3分割してステータスに
  const atk = parseInt(hash.slice(0, 8), 16) % 100
  const def = parseInt(hash.slice(8, 16), 16) % 100
  const spd = parseInt(hash.slice(16, 24), 16) % 100

  // パリティチェック用
  const parity = (atk + def + spd) % 10

  return { atk, def, spd, parity }
}
```

### パリティの意味

- 合計値の下1桁をパリティとして保持
- バーコードに埋め込む
- 改ざん検知に使用

### 重複しないことの保証

- eventIdはNostrで一意（署名ハッシュ）
- 同じ投稿 = 同じバーコード = 同じステータス
- 再現性がある

## バーコードの視覚表現

### エンコード形式

```
| ATK(7bit) | DEF(7bit) | SPD(7bit) | PARITY(4bit) | CHECK(3bit) |
```

### バーコード生成

```typescript
function generateBarcode(stats: Stats): string {
  const { atk, def, spd, parity } = stats

  // 7bitずつ + パリティ + チェックサム
  const binary =
    atk.toString(2).padStart(7, '0') +
    def.toString(2).padStart(7, '0') +
    spd.toString(2).padStart(7, '0') +
    parity.toString(2).padStart(4, '0')

  // チェックサム（XOR）
  const checksum = binary.split('').reduce((a, b) => a ^ parseInt(b), 0)

  return binary + checksum.toString(2).padStart(3, '0')
}
```

### SVG描画

```tsx
function BarcodeDisplay({ stats }: { stats: Stats }) {
  const barcode = generateBarcode(stats)
  const bars = barcode.split('').map((bit, i) => (
    <rect
      key={i}
      x={i * 3}
      y={0}
      width={bit === '1' ? 2 : 1}
      height={20}
      fill={bit === '1' ? '#000' : '#fff'}
    />
  ))

  return (
    <svg width={barcode.length * 3} height={24}>
      {bars}
      <text x={0} y={24} fontSize={8}>
        ATK {stats.atk}
      </text>
    </svg>
  )
}
```

## バトルシステム

### バトル画面

```
┌─ バーコードバトル ────────────────────────┐
│                                          │
│   ╔════════════════╗  VS  ╔════════════════╗
│   ║  @userA の投稿  ║      ║  @userB の投稿  ║
│   ║                ║      ║                ║
│   ║  ║│║│║║│║│║    ║      ║  │║║│║│║║│    ║
│   ║                ║      ║                ║
│   ║  ATK: 78 ←WIN  ║      ║  ATK: 45       ║
│   ║  DEF: 34       ║      ║  DEF: 89 ←WIN  ║
│   ║  SPD: 56       ║      ║  SPD: 23       ║
│   ╚════════════════╝      ╚════════════════╝
│                                          │
│              RESULT: DRAW                │
│                                          │
│   [別の投稿で再戦]    [シェア]            │
└──────────────────────────────────────────┘
```

### 勝敗判定

```typescript
function battle(a: Stats, b: Stats): 'A' | 'B' | 'DRAW' {
  let aWins = 0
  let bWins = 0

  // ATK vs DEF（ATKが高い方が勝ち）
  if (a.atk > b.def) aWins++
  else if (b.atk > a.def) bWins++

  // DEF vs SPD（DEFが高い方が勝ち）
  if (a.def > b.spd) aWins++
  else if (b.def > a.spd) bWins++

  // SPD vs ATK（SPDが高い方が勝ち）
  if (a.spd > b.atk) aWins++
  else if (b.spd > a.atk) bWins++

  if (aWins > bWins) return 'A'
  if (bWins > aWins) return 'B'
  return 'DRAW'
}
```

### 別の勝敗方式（シンプル版）

```typescript
// 最も高いステータスで勝負
function simpleBattle(a: Stats, b: Stats): 'A' | 'B' | 'DRAW' {
  const aMax = getMaxStat(a)  // { stat: 'atk', value: 78 }
  const bMax = getMaxStat(b)  // { stat: 'def', value: 89 }

  // 3すくみ判定
  if (beats(aMax.stat, bMax.stat)) return 'A'
  if (beats(bMax.stat, aMax.stat)) return 'B'

  // 同じ属性なら数値勝負
  if (aMax.value > bMax.value) return 'A'
  if (bMax.value > aMax.value) return 'B'
  return 'DRAW'
}

function beats(a: string, b: string): boolean {
  return (
    (a === 'atk' && b === 'def') ||
    (a === 'def' && b === 'spd') ||
    (a === 'spd' && b === 'atk')
  )
}
```

## バトルの始め方

### 方法1: 投稿を選んでバトル

1. 自分の投稿の「バトル」ボタンをクリック
2. 対戦相手の投稿を選択
3. バトル開始

### 方法2: タイムラインでランダムマッチ

1. 「ランダムバトル」ボタン
2. タイムラインからランダムに2投稿を選出
3. バトル開始

### 方法3: バトル招待

1. 自分の投稿のバーコードをシェア
2. 相手が自分の投稿のバーコードで応戦
3. 結果を投稿

## 実装

### バーコードコンポーネント

```tsx
interface PostBarcodeProps {
  eventId: string
  content: string
  showStats?: boolean
}

function PostBarcode({ eventId, content, showStats = false }: PostBarcodeProps) {
  const stats = useMemo(
    () => generateStats(eventId, content),
    [eventId, content]
  )

  return (
    <div className="post-barcode">
      <BarcodeDisplay stats={stats} />
      {showStats && (
        <div className="barcode-stats">
          <span className="stat-atk">ATK {stats.atk}</span>
          <span className="stat-def">DEF {stats.def}</span>
          <span className="stat-spd">SPD {stats.spd}</span>
        </div>
      )}
    </div>
  )
}
```

### CSS

```css
.post-barcode {
  position: absolute;
  bottom: 0.5rem;
  right: 0.5rem;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.post-barcode:hover {
  opacity: 1;
}

.barcode-stats {
  font-size: 0.6rem;
  font-family: monospace;
  display: flex;
  gap: 0.25rem;
}

.stat-atk { color: #ff4444; }
.stat-def { color: #4444ff; }
.stat-spd { color: #44ff44; }
```

## ゲーム性の拡張

### レアリティ

合計値（ATK+DEF+SPD）でレアリティ判定:

| 合計 | レアリティ | 確率 |
|------|-----------|------|
| 0-99 | Common | 約33% |
| 100-149 | Uncommon | 約33% |
| 150-199 | Rare | 約25% |
| 200-249 | Super Rare | 約8% |
| 250-297 | Ultra Rare | 約1% |

### 強い投稿を探す遊び

- 「今日の最強バーコード」
- 「Ultra Rare が出るまで投稿」
- 強いバーコードの投稿は保存される

### トーナメント

- 定期的にバーコードトーナメント開催
- 優勝者には紫ステラ

## 実装優先度

1. ステータス生成アルゴリズム
2. バーコード表示（投稿カード）
3. ステータス表示（ホバー時）
4. バトル機能（1対1）
5. バトル結果シェア
6. ランダムマッチ
7. レアリティ表示
8. トーナメント機能

## 注意点

- バーコードは装飾であり、邪魔にならないように
- ホバーで詳細表示（常時は控えめ）
- バトルは強制ではない（楽しみたい人だけ）
- 投稿の質 ≠ バーコードの強さ（あくまでお遊び）
