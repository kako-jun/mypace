# aurora（テーマカラー）

投稿カードの背景に4隅グラデーションを設定する機能。
PS1 FF7のウィンドウカラーカスタマイズにインスパイアされた。

## タグ形式

```json
["aurora", "<topLeft>", "<topRight>", "<bottomLeft>", "<bottomRight>"]
```

各値はCSSカラー形式（例: `#ff0000`, `rgb(255,0,0)`）。

## 使用例

```json
{
  "kind": 1,
  "content": "Hello, Nostr!",
  "tags": [
    ["t", "mypace"],
    ["client", "mypace"],
    ["aurora", "#1a1a2e", "#16213e", "#0f3460", "#e94560"]
  ]
}
```

## 表示

MyPaceクライアントでは、投稿カードの背景が4隅から中央に向かってグラデーションで描画される。

```css
background:
  linear-gradient(to bottom right, var(--top-left), transparent),
  linear-gradient(to bottom left, var(--top-right), transparent),
  linear-gradient(to top right, var(--bottom-left), transparent),
  linear-gradient(to top left, var(--bottom-right), transparent);
```

## テキスト色の自動調整

背景の明暗を判定し、テキスト色を自動で白/黒に切り替える。

```typescript
// 4隅の平均輝度を計算
const avgLuminance = (luminance(topLeft) + luminance(topRight) +
                      luminance(bottomLeft) + luminance(bottomRight)) / 4
// 暗い背景なら白文字、明るい背景なら黒文字
const textColor = avgLuminance < 0.5 ? '#ffffff' : '#000000'
```

## 他クライアントでの表示

`aurora` タグは無視され、通常のテキスト投稿として表示される。
