# Wordrot（ワードロット）

投稿から名詞を収集し、Word2Vecのようなベクトル演算で新しい単語を合成する機能。
「言葉が腐る」= brainrot的な美学で、変な結果も楽しむコレクション要素。

## 背景

- Word2Vecの有名な例: 「王様 - 男 + 女 = 女王」
- ゲーム的な例: 「ファイアマリオ - マリオ + ルイージ = ファイアルイージ」
- タイムライン上の投稿から名詞を見つけてクリックで収集
- 収集した単語を使って A - B + C = ? の合成を楽しむ
- 単語ごとにAI生成のキャラクター画像が付く（ドット絵/2頭身）

## コンセプト

### 収集の楽しさ

- タイムラインを眺めているだけで「お、この単語まだ持ってない」と気づく
- クリックして収集 → ゲットした感覚
- 同じ単語は1回のみ収集可能（重複なし）
- レアな単語、変な単語を見つける喜び

### 合成の楽しさ

- 3つの単語を組み合わせて新しい単語を生み出す
- 結果はLLMが意味的に計算（ベクトル演算的な動作）
- 変な結果が出ても「brainrot」として楽しむ
- 新しい単語を最初に生み出した人は「発見者」

### 画像生成

- 単語が初めてシステムに登録されたとき、AI画像を生成
- 統一フォーマット: 正方形、ドット絵または2頭身キャラ
- 変な絵でも「味がある」として受け入れる美学
- 画像はnostr.buildにアップロードして永続化

## データフロー

### タイムライン表示時

```
1. タイムライン読み込み（50件）
   ↓
2. 投稿を画面に表示（この時点ではハイライトなし）
   ↓
3. 並行して: POST /api/wordrot/batch
   - eventIds: 表示中の50件のID
   - contents: 各投稿の本文
   - pubkey: 閲覧ユーザー
   ↓
4. API側処理:
   - wordrot_event_words テーブルをチェック
   - キャッシュ済み → 即座に返す
   - 未抽出 → LLMで名詞抽出（同期）
   - ユーザーのインベントリも取得
   ↓
5. レスポンス:
   {
     words: { eventId1: ["単語A", "単語B"], ... },
     collected: ["単語A", ...]  // ユーザーが既に持っている
   }
   ↓
6. State更新 → 全投稿のハイライトが一斉に表示
```

**重要**: ハイライトは段階的に増えない。全件揃ってから一斉表示。

### 単語収集時

```
1. ユーザーが未収集の単語をクリック
   ↓
2. POST /api/wordrot/collect
   - pubkey: ユーザー
   - word: クリックした単語テキスト
   - eventId: 投稿ID（オプション）
   ↓
3. API側処理:
   - wordrot_words テーブルに単語がなければ作成
   - 新規単語なら画像生成をキュー
   - wordrot_user_words にレコード追加/更新
   ↓
4. レスポンス:
   {
     word: { id, text, imageUrl, ... },
     isFirstEver: true/false  // 全ユーザーで初（発見者）
   }
   ↓
5. 収集演出（モーダル表示）
```

### 単語合成時

```
1. ユーザーがスロットA, B, Cに単語をセット
   例: A=ファイアマリオ, B=マリオ, C=ルイージ
   ↓
2. POST /api/wordrot/synthesize
   - pubkey: ユーザー
   - slotA, slotB, slotC: 単語テキスト
   ↓
3. API側処理:
   - LLMに「A - B + C = ?」を計算させる
   - 結果の単語がDBになければ作成
   - wordrot_syntheses に合成記録
   - 新規単語なら画像生成をキュー
   ↓
4. レスポンス:
   {
     result: { id, text, imageUrl, ... },
     formula: "ファイアマリオ - マリオ + ルイージ = ファイアルイージ",
     isNewWord: true/false,      // 単語自体が新規
     isNewSynthesis: true/false  // この組み合わせが新規
   }
```

## DBスキーマ

### wordrot_words（単語マスター）

全ユーザー共通の単語辞書。

```sql
CREATE TABLE IF NOT EXISTS wordrot_words (
  id TEXT PRIMARY KEY,           -- UUID
  text TEXT NOT NULL UNIQUE,     -- 単語テキスト（正規化済み）
  image_url TEXT,                -- 生成された画像URL
  image_status TEXT DEFAULT 'pending',  -- pending/generating/done/failed
  discovered_by TEXT,            -- 最初に登録したユーザーのpubkey
  discovered_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wordrot_words_text ON wordrot_words(text);
CREATE INDEX IF NOT EXISTS idx_wordrot_words_status ON wordrot_words(image_status);
```

### wordrot_user_words（ユーザーインベントリ）

各ユーザーが収集した単語。

```sql
CREATE TABLE IF NOT EXISTS wordrot_user_words (
  pubkey TEXT NOT NULL,
  word_id TEXT NOT NULL,
  collected_at INTEGER NOT NULL,
  PRIMARY KEY (pubkey, word_id)
);

CREATE INDEX IF NOT EXISTS idx_wordrot_user_words_pubkey ON wordrot_user_words(pubkey);
```

### wordrot_event_words（投稿別キャッシュ）

投稿ごとの抽出結果キャッシュ。

```sql
CREATE TABLE IF NOT EXISTS wordrot_event_words (
  event_id TEXT PRIMARY KEY,
  words TEXT NOT NULL,           -- JSON配列: ["単語A", "単語B", ...]
  extracted_at INTEGER NOT NULL
);
```

### wordrot_syntheses（合成記録）

過去の合成履歴。同じ組み合わせは同じ結果を返す。

```sql
CREATE TABLE IF NOT EXISTS wordrot_syntheses (
  id TEXT PRIMARY KEY,           -- UUID
  slot_a TEXT NOT NULL,          -- 単語Aのテキスト
  slot_b TEXT NOT NULL,          -- 単語Bのテキスト
  slot_c TEXT NOT NULL,          -- 単語Cのテキスト
  result_word_id TEXT NOT NULL,  -- 結果の単語ID
  created_by TEXT NOT NULL,      -- 最初に合成したユーザー
  created_at INTEGER NOT NULL,
  UNIQUE(slot_a, slot_b, slot_c)
);

CREATE INDEX IF NOT EXISTS idx_wordrot_syntheses_combo
  ON wordrot_syntheses(slot_a, slot_b, slot_c);
```

### wordrot_image_queue（画像生成キュー）

バックグラウンド画像生成用。

```sql
CREATE TABLE IF NOT EXISTS wordrot_image_queue (
  word_id TEXT PRIMARY KEY,
  status TEXT DEFAULT 'pending',  -- pending/processing/done/failed
  attempts INTEGER DEFAULT 0,
  last_attempt_at INTEGER,
  created_at INTEGER NOT NULL
);
```

## API仕様

### バッチ単語取得

タイムライン表示時に呼び出す。

```
POST /api/wordrot/batch
```

リクエスト:

```json
{
  "events": [
    { "eventId": "abc123", "content": "今日マリオカートで..." },
    { "eventId": "def456", "content": "ルイージ最高！" }
  ],
  "pubkey": "user_pubkey_here"
}
```

レスポンス:

```json
{
  "words": {
    "abc123": ["マリオカート", "今日"],
    "def456": ["ルイージ"]
  },
  "collected": ["マリオカート"],
  "wordImages": {
    "マリオカート": "https://nostr.build/xxx.png",
    "ルイージ": "https://nostr.build/yyy.png"
  }
}
```

### 単語収集

```
POST /api/wordrot/collect
```

リクエスト:

```json
{
  "pubkey": "user_pubkey_here",
  "word": "ルイージ",
  "eventId": "def456"
}
```

レスポンス:

```json
{
  "word": {
    "id": "word_uuid",
    "text": "ルイージ",
    "imageUrl": "https://nostr.build/yyy.png"
  },
  "isFirstEver": false
}
```

**注意**: 収集済みの単語はUI側でクリック不可にするため、重複リクエストは発生しない。

### 単語合成

```
POST /api/wordrot/synthesize
```

リクエスト:

```json
{
  "pubkey": "user_pubkey_here",
  "slotA": "ファイアマリオ",
  "slotB": "マリオ",
  "slotC": "ルイージ"
}
```

レスポンス:

```json
{
  "result": {
    "id": "result_word_uuid",
    "text": "ファイアルイージ",
    "imageUrl": "https://nostr.build/zzz.png"
  },
  "formula": "ファイアマリオ - マリオ + ルイージ = ファイアルイージ",
  "isNewWord": true,
  "isNewSynthesis": true
}
```

エラー時:

```json
{
  "error": "Synthesis failed: could not compute result"
}
```

### インベントリ取得

```
GET /api/wordrot/inventory/:pubkey
```

レスポンス:

```json
{
  "words": [
    { "id": "...", "text": "マリオ", "imageUrl": "..." },
    { "id": "...", "text": "ルイージ", "imageUrl": "..." }
  ],
  "count": 8
}
```

## UI仕様

### タイムライン上のハイライト表示

投稿本文内の収集可能な単語をハイライト表示する。

**未収集の単語**:
- 背景色: 薄い紫（アクセントカラー）
- 左に小さなアイコン（Sparkles）
- ホバー時: 背景色が濃くなる
- カーソル: pointer

**収集済みの単語**:
- 背景色: 薄いグレー
- 左にチェックアイコン（Check）
- クリック不可（pointer-events: none または disabled状態）
- カーソル: default

```
┌─────────────────────────────────────────────────────┐
│ 投稿本文:                                           │
│                                                     │
│ 今日[*マリオカート]で[v ルイージ]使って             │
│ [*スター]取った！                                   │
│                                                     │
│ [*] = 未収集（目立つ、クリック可能）                │
│ [v] = 収集済み（控えめ）                            │
└─────────────────────────────────────────────────────┘
```

### 収集モーダル

単語クリック時に表示する収集演出。

```
┌────────────────────────────────────┐
│                                    │
│         [単語の画像]               │
│          (128x128)                 │
│                                    │
│        **マリオカート**            │
│          GET!                      │
│                                    │
│    [First Discovery!] ← 初発見時   │
│                                    │
│    [View Inventory]  [Close]       │
└────────────────────────────────────┘
```

- 画像がまだない場合はプレースホルダー表示
- 3秒後に自動クローズ（またはクリック/Escで即時）

### インベントリページ（Wordrotタブ）

```
┌─────────────────────────────────────────────────────┐
│ Inventory                                           │
│ [Star] Stella    [FlaskConical] Wordrot             │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Word Synthesis                                  │ │
│ │ Combine words: A - B + C = ?                    │ │
│ │                                                 │ │
│ │  [Slot A]  -  [Slot B]  +  [Slot C]  =  [???]  │ │
│ │                                                 │ │
│ │           [Clear]  [Synthesize]                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Word Collection (8 words)                       │ │
│ │                                                 │ │
│ │ [img] [img] [img] [img] [img] [img]            │ │
│ │ マリオ ルイージ  スター  キノコ  ...            │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### ワードカード

個々の単語を表示するカードコンポーネント。

```
┌──────────┐
│  [画像]  │  64x64 または 48x48
│          │
│  単語名  │  テキスト（折り返し）
└──────────┘
```

**状態による表示**:
- 通常: 黒枠、白背景
- 選択中（合成スロット用）: 紫枠、薄紫背景
- ホバー: 影が付く

## アクセシビリティ

### 色に依存しない識別

色覚異常のユーザーでも区別できるよう、色だけでなくアイコンや形状で区別する。

**未収集 vs 収集済み**:
- 未収集: Sparklesアイコン + 紫系背景 + **太字**
- 収集済み: Checkアイコン + グレー背景 + 通常weight

**アイコンの使用**:
- 絵文字は使用しない
- Lucide iconsのSVGを使用
- 主要アイコン: Sparkles, Check, FlaskConical, BookOpen, Plus, Minus

### コントラスト

- ハイライト背景色は十分なコントラスト比を確保
- テキストは常に読みやすい色
- ダークモードでも同様の区別が可能

## LLM処理

### 名詞抽出

Workers AI (LLaMA 3.1 8B) を使用。

プロンプト例:

```
以下のテキストから名詞（固有名詞、一般名詞）を抽出してください。
動詞、形容詞、助詞は除外してください。
JSON配列形式で出力してください。

テキスト: 今日マリオカートでルイージ使ってスター取った！

出力: ["今日", "マリオカート", "ルイージ", "スター"]
```

### 単語合成

プロンプト例:

```
Word2Vecのようなベクトル演算を意味的に行ってください。

計算: ファイアマリオ - マリオ + ルイージ = ?

「ファイアマリオ」から「マリオ」の要素を引き、「ルイージ」の要素を足すと
どのような概念になるか、1つの単語または短いフレーズで答えてください。

回答:
```

### 画像生成

Workers AI (Stable Diffusion XL) を使用。

プロンプト例:

```
A cute chibi pixel art character representing "{word}",
2-head-tall proportions, simple background,
game sprite style, square format
```

生成後、nostr.build APIでアップロード。

## 今後の拡張候補

- 単語のレアリティシステム（出現頻度に基づく）
- 合成履歴の公開（誰がどんな単語を生み出したか）
- 単語図鑑のコンプリート要素
- 特定の合成でSupernova解除
- 単語トレード機能

## ファイル構成

```
apps/api/src/routes/wordrot.ts       # APIエンドポイント
apps/web/src/hooks/wordrot/
  ├── index.ts
  ├── useWordrot.ts                  # 収集・インベントリ
  └── useSynthesis.ts                # 合成
apps/web/src/components/wordrot/
  ├── index.ts
  ├── WordCard.tsx                   # 単語カード
  ├── WordHighlight.tsx              # 本文内ハイライト
  ├── CollectCelebration.tsx         # 収集演出モーダル
  └── SynthesisPanel.tsx             # 合成UI
apps/web/src/styles/components/
  ├── word-card.css
  ├── word-highlight.css
  ├── collect-celebration.css
  └── synthesis-panel.css
```

[← 拡張仕様一覧に戻る](./index.md)
