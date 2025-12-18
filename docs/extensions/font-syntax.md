# Font構文

HTMLの`<font>`タグ風の記法で文字色とサイズを指定する機能。
実際のHTMLタグではなく、MyPace独自の構文として処理される。

## 構文

```
<font color="色" size="サイズ">テキスト</font>
```

## 属性

### color

色名またはHEX値:

```
<font color="red">赤い文字</font>
<font color="#FF5500">カスタム色</font>
<font color=#F00>短縮HEX（引用符なしも可）</font>
```

**許可される色名:**
- red, blue, green, yellow, orange, purple, pink
- cyan, magenta, lime, navy, teal, maroon
- white, black, gray, grey, silver

**許可されるHEX形式:**
- `#RGB` (3桁)
- `#RRGGBB` (6桁)

**対応しない形式:**
- `rgb()`, `rgba()`, `hsl()` などのCSS関数
- 上記以外の色名

### size

**1〜5 の整数のみ対応**

| size | 実際のサイズ | 用途 |
|------|-------------|------|
| 1 | 0.5em | 注釈、小さい補足 |
| 2 | 0.75em | 補足テキスト |
| 3 | 1em | デフォルト（通常サイズ） |
| 4 | 1.5em | 強調、小見出し |
| 5 | 2em | 大見出し |

```
<font size="1">極小</font>
<font size="2">小さい</font>
<font size="3">普通</font>
<font size="4">大きい</font>
<font size="5">特大</font>
```

**対応しない形式:**
- `size="6"` 以上の数値 → 無視
- `size="+1"` のような相対指定 → 無視
- `size="2em"` のようなCSS単位 → 無視

### 複合指定

```
<font color="red" size="5">赤くて大きい</font>
<font size=4 color=#00F>青くて大きい（引用符なし）</font>
```

## 閉じタグなしの場合

閉じタグがない場合、行末または次のタグまで適用:

```
<font color="red">赤い文字が続く
次の行は通常に戻る
```

## 使用例

### 強調・整理

```
<font color="red" size="4">重要</font>: 締め切りは明日です。

<font color="blue">ポイント1:</font> まず準備をする
<font color="blue">ポイント2:</font> 次に実行する

<font color="gray" size="1">※ 詳細は後日追記予定</font>
```

### 見出し構成（アライメントと併用）

```
>< <font color="navy" size="5">第一章 はじまり</font>

ここから本文が始まる。
途中で<font color="red">重要な部分</font>を強調したり、
<font color="green">キーワード</font>に色をつけたりする。

>< <font color="navy" size="4">1-1. 背景</font>

小見出しはやや小さめに。

>> <font color="gray" size="1">— 続く</font>
```

### 会話の書き分け

```
<font color="red">太郎:</font>「おはよう」
<font color="blue">花子:</font>「おはよう。今日は早いね」
<font color="red">太郎:</font>「<font size="4">大事な話</font>があるんだ」
```

## 実装詳細

### 処理タイミング

Font構文は**HTMLエスケープ後**に処理される。
これにより、XSS攻撃を防ぎつつ独自構文として認識する。

```
1. コードブロック抽出
2. アライメント抽出
3. HTML全エスケープ ← <font> → &lt;font&gt;
4. Markdown解析
5. アライメント復元
6. Font構文処理 ← ここで &lt;font&gt; を処理
7. その他の処理
8. コードブロック復元
```

### 生成されるHTML

```html
<!-- <font color="red" size="4">テキスト</font> -->
<span style="color: red; font-size: 1.5em">テキスト</span>
```

### セキュリティ

- 実際の`<font>`タグは受け付けない（エスケープされる）
- 許可リストにない色名は無視
- 許可リストにないサイズは無視
- `style`属性には`color`と`font-size`のみ出力

## 注意点

- コードブロック内では処理されない（そのまま表示）
- ネストした`<font>`タグは内側から順に処理される
- Markdownの`**強調**`や`*イタリック*`と併用可能

## 他のNostrクライアントでの表示

HTMLをサポートするクライアント:
- `<font>`タグがそのまま解釈される可能性あり

HTMLを無視するクライアント:
- タグが除去されてテキストのみ表示

いずれにせよ内容は伝わる。
