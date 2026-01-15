# バーコードバトラー機能計画

## 概要

90年代の「バーコードバトラー」をオマージュ。
投稿からバーコードを生成し、バトルできる機能。

## コンセプト

- 各投稿に一意のバーコードが表示される
- バーコードはeventIDから生成（投稿内容は使わない＝編集しても変わらない）
- バーコード同士をバトルさせられる
- じゃんけん的な3すくみの戦闘システム

## バーコード表示

### 投稿カードでの表示

```
┌─ 投稿 ──────────────────────────────┬═╗
│ @username · 2時間前                 │║│
│                                     │║│ ← バーコード（縦向き）
│ 今日のランチ美味しかった！           │║│
│                                     │R │ ← レアリティ
└─────────────────────────────────────┴─┘
```

### バーコードのサイズ・位置

- コンテナ幅: 24px
- コンテナ高さ: 90px
- バーの長さ: 18px
- 位置: 投稿カード右辺に接地（縦向き・90度回転）
- コンテナはカード右辺から6px外側に配置（right: -6px）

### 表示箇所

| 箇所 | 表示 | 理由 |
|------|------|------|
| タイムラインの投稿カード | ✅ | メイン表示 |
| 投稿個別ページの主記事 | ✅ | メイン表示 |
| 元記事カード（Reply to） | ❌ | 高さが足りない |
| リプライカード | ❌ | 高さが足りない |
| インデントされたリプライ | ❌ | 高さが足りない |

### 表示状態

- 通常時: opacity 0.3（控えめ）
- ホバー時: opacity 0.7 + 背景色（バーコードリーダーで読める状態）

### テーマ対応

| テーマ | バーコード色 | ホバー時背景 |
|--------|-------------|-------------|
| ライト | 黒 | 白 (#fff) |
| ダーク | 白 | 黒 (#000) |

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
// eventIDのみを使用（contentは使わない＝編集しても値は変わらない）
async function generateStats(eventId: string): Promise<Stats> {
  const hash = await sha256(eventId)

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
- 編集してもeventIdは変わらないため、バーコードも変わらない

## バーコードの視覚表現（実装済み）

### バーコード規格

**Code 128** を使用（JsBarcodeライブラリ）

- 実際のバーコードリーダーで読み取り可能
- バーの太さは1〜4単位（規格準拠）

### エンコード形式

```
AADDSS （6桁の数字）
```

| 位置 | 内容 | 例 |
|------|------|-----|
| 1-2桁 | ATK (00-99) | 78 |
| 3-4桁 | DEF (00-99) | 34 |
| 5-6桁 | SPD (00-99) | 56 |

例: ATK=78, DEF=34, SPD=56 → `783456`

### バーコード生成

```typescript
import JsBarcode from 'jsbarcode'

function statsToCode(stats: BarcodeStats): string {
  const atk = stats.atk.toString().padStart(2, '0')
  const def = stats.def.toString().padStart(2, '0')
  const spd = stats.spd.toString().padStart(2, '0')
  return `${atk}${def}${spd}`
}

// SVG要素に描画
JsBarcode(svgRef.current, statsToCode(stats), {
  format: 'CODE128',
  width: 1,
  height: 18,
  displayValue: false,
  margin: 0,
  background: 'transparent',
  lineColor: 'currentColor',
})
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

## 実装（実装済み）

### ファイル構成

- `apps/web/src/lib/barcode/barcode.ts` - ステータス生成ロジック
- `apps/web/src/components/post/PostBarcode.tsx` - 表示コンポーネント（JsBarcode使用）
- `apps/web/src/styles/components/post-card.css` - スタイル

### 依存ライブラリ

- `jsbarcode` - Code 128バーコード生成

### バーコードコンポーネント

```tsx
import JsBarcode from 'jsbarcode'

const RARITY_LABEL = {
  common: 'N',
  uncommon: 'R',
  rare: 'SR',
  'super-rare': 'UR',
} as const

function PostBarcode({ eventId }: { eventId: string }) {
  const [stats, setStats] = useState<BarcodeStats | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    generateStats(eventId).then(setStats)
  }, [eventId])

  useEffect(() => {
    if (!stats || !svgRef.current) return
    JsBarcode(svgRef.current, statsToCode(stats), {
      format: 'CODE128',
      width: 1,
      height: 18,
      displayValue: false,
      margin: 0,
      background: 'transparent',
      lineColor: 'currentColor',
    })
  }, [stats])

  return (
    <div className="post-barcode">
      <svg ref={svgRef} />
      <span className="post-barcode-rarity">{RARITY_LABEL[rarity]}</span>
    </div>
  )
}
```

### CSS

```css
.post-barcode {
  position: absolute;
  right: -6px;
  top: 0;
  width: 24px;
  height: 90px;
  padding: 2px 2px 2px 1px;
  color: #000;
  opacity: 0.3;
  pointer-events: none;
  transition: opacity 0.2s ease, background-color 0.2s ease;
  overflow: visible;
}

.post-barcode svg {
  position: absolute;
  right: 4px;
  top: 68px;
  transform: rotate(90deg);
  transform-origin: top right;
}

.post-card:hover .post-barcode {
  opacity: 0.7;
  background-color: #fff;
}

[data-theme="dark"] .post-barcode {
  color: #fff;
}

[data-theme="dark"] .post-card:hover .post-barcode {
  background-color: #000;
}

.post-barcode-rarity {
  position: absolute;
  right: 2px;
  top: 74px;
  font-size: 10px;
  font-weight: bold;
  font-family: var(--font-mono);
  text-shadow: none;
  writing-mode: vertical-lr;
  transform: rotate(180deg);
}
```

## ゲーム性の拡張

### レアリティ（実装済み）

合計値（ATK+DEF+SPD）でレアリティ判定（遊戯王風の4段階）:

| 合計 | レアリティ | 表示 | 出現率 |
|------|-----------|------|--------|
| 0-149 | Normal | N | ~50% |
| 150-199 | Rare | R | ~33% |
| 200-249 | Super Rare | SR | ~15% |
| 250-297 | Ultra Rare | UR | ~2% |

- レアリティはバーコードの下に縦書き（太字）で表示
- 色はバーコードと同じ（ライト=黒、ダーク=白）

### 強い投稿を探す遊び

- 「今日の最強バーコード」
- 「UR が出るまで投稿」
- 強いバーコードの投稿は保存される

### トーナメント

- 定期的にバーコードトーナメント開催
- 優勝者には紫ステラ

## 実装優先度

1. ✅ ステータス生成アルゴリズム（SHA-256ハッシュから生成）
2. ✅ バーコード表示（Code 128規格、JsBarcode使用）
3. ✅ バーコード縦向き配置（90度回転）
4. ✅ レアリティ表示（N/R/SR/UR、太字）
5. ✅ ホバー時の背景表示（ライト=白、ダーク=黒）
6. ✅ ダークテーマ対応（白いバーコード）
7. バトル機能（1対1）
8. バトル結果シェア
9. ランダムマッチ
10. トーナメント機能

## 注意点

- バーコードは装飾であり、邪魔にならないように
- ホバーで詳細表示（常時は控えめ）
- バトルは強制ではない（楽しみたい人だけ）
- 投稿の質 ≠ バーコードの強さ（あくまでお遊び）
