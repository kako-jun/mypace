# アライメント構文

Markdownにない左寄せ/右寄せ/センタリングを独自構文で実現する。
テキストだけでなく、画像やあらゆるコンテンツに適用可能。

## 構文

| 記法 | 意味 | CSSクラス |
|------|------|-----------|
| `<<` | 左寄せ | `align-left` |
| `>>` | 右寄せ | `align-right` |
| `><` | センタリング | `align-center` |
| `<>` | 左右分割 | `align-split` |

行頭にマーカーを置き、その行のコンテンツにアライメントを適用。

## 使用例

### 基本

```
<< 左寄せテキスト
>> 右寄せテキスト
>< センタリング
```

### 空行（装飾用）

マーカーのみの行も有効:

```
><
>< タイトル
><
```

### 左右分割

`|` で区切って左右に配置:

```
<> 左のテキスト | 右のテキスト
<> りんご | ¥100
<> みかん | ¥80
```

表示:
```
┌────────────────────────────────────┐
│ 左のテキスト          右のテキスト │
│ りんご                        ¥100 │
│ みかん                         ¥80 │
└────────────────────────────────────┘
```

### 会話風（LINE風）

```
<< https://example.com/charA.png
<< こんにちは
>> やあ！
<< 元気？
>> うん！
```

### 署名・フッター

```
本文がここに...

>> — 著者名
>> 2025年1月
```

### Font構文との併用

```
>< <font color="navy" size="5">第一章 はじまり</font>
<< <font color="red">重要:</font> これは大事な内容です
>> <font color="gray" size="2">— 続く</font>
```

## 実装詳細

### 処理タイミング

アライメント構文はMarkdown解析の**前**に抽出され、プレースホルダーに置換される。
これによりMarkdownの構文（`>`引用など）との干渉を避ける。

```
1. コードブロック抽出（保護）
2. アライメント抽出 ← ここ
3. HTML全エスケープ
4. Markdown解析
5. アライメント復元 ← ここでHTML化
6. その他の処理
7. コードブロック復元
```

### 生成されるHTML

```html
<!-- << テキスト -->
<div class="align-left">テキスト</div>

<!-- >> テキスト -->
<div class="align-right">テキスト</div>

<!-- >< テキスト -->
<div class="align-center">テキスト</div>

<!-- <> 左 | 右 -->
<div class="align-split"><span>左</span><span>右</span></div>
```

### CSS

```css
.align-left {
  text-align: left;
}

.align-right {
  text-align: right;
}

.align-center {
  text-align: center;
}

.align-split {
  display: flex;
  justify-content: space-between;
}

/* 画像のアライメント */
.align-left img { display: block; margin-right: auto; }
.align-right img { display: block; margin-left: auto; }
.align-center img { display: block; margin: 0 auto; }
```

## 注意点

- マーカーと内容の間にはスペースが必要: `<< テキスト`（`<<テキスト` は無効）
- マーカーのみの行（`<<`, `>>`, `><`）は空のアライメントブロックを生成
- 行単位の適用（複数行ブロックには非対応）
- コードブロック内では処理されない（そのまま表示）

## 他のNostrクライアントでの表示

マーカーがそのまま表示される:

```
<< こんにちは
>> やあ！
```

内容は読めるが、アライメントは適用されない。
