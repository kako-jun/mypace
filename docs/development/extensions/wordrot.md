# Wordrot（ワードロット）

投稿から名詞を収集し、Word2Vecのようなベクトル演算で新しい単語を合成する機能。
「言葉が腐る」= brainrot的な美学で、変な結果も楽しむコレクション要素。

## 用語

| 用語                   | 英語    | 説明                                                                             |
| ---------------------- | ------- | -------------------------------------------------------------------------------- |
| ワード (Word)          | Word    | 投稿から収集した合成前の単語。黄色背景の物体アイコン画像。                       |
| ワードロット (Wordrot) | Wordrot | 合成によって生まれた単語。黄緑背景の可愛い生物画像。FlaskConicalアイコンで表す。 |

## フェーズ

| フェーズ | 内容                                                           | 状態     |
| -------- | -------------------------------------------------------------- | -------- |
| Phase 1  | 単語収集（タイムラインハイライト、クリック収集、インベントリ） | 実装済み |
| Phase 2  | 単語合成（A - B + C = ?）                                      | 実装済み |

## 背景

- Word2Vecの有名な例: 「王様 - 男 + 女 = 女王」
- ゲーム的な例: 「ファイアマリオ - マリオ + ルイージ = ファイアルイージ」
- タイムライン上の投稿から名詞を見つけてクリックで収集
- 収集した単語を使って合成を楽しむ
- 単語ごとにAI生成の16bitピクセルアート画像が付く
- ワード（Word）: 黄色背景（#F1C40F）の物体アイコン — 投稿から収集した素材
- ワードロット（Wordrot）: 黄緑背景（#8BC34A）の可愛い生物クリーチャー — 合成で誕生

## コンセプト

### 収集の楽しさ（Phase 1）

- タイムラインを眺めているだけで「お、この単語まだ持ってない」と気づく
- クリックして収集 → ゲットした感覚
- 同じ単語は1回のみ収集可能（重複なし）
- レアな単語、変な単語を見つける喜び

### 合成の楽しさ（Phase 2）

- 投稿から収集したワード（Word）を組み合わせて新しいワードロット（Wordrot）を生み出す
- 演算式: A - B + C = ?（Word2Vecスタイルのベクトル演算）
- **合成素材**:ワード（harvest）のみ使用可能。ワードロット（synthesis）は素材にできない
- 結果はLLMが意味的に計算
- 変な結果が出ても「brainrot」として楽しむ
- 新しい単語を最初に生み出した人は「発見者」
- 同じ組み合わせはキャッシュされ、`use_count` で人気度を追跡

### 画像生成（Phase 1 + Phase 2）

- 単語が初めてシステムに登録されたとき、AI画像を非同期生成
- **ワード（Word）**: 16bitピクセルアート、黄色背景（#F1C40F）、物体のアイコン
- **ワードロット（Wordrot）**: 16bitピクセルアート、黄緑背景（#8BC34A）、可愛い丸い生物
  - 背景色でワード/ワードロットを視覚的に区別（ステラ=黄色、ワードロット=黄緑、将来のさらなる合成=緑系統）
- 変な絵でも「味がある」として受け入れる美学
- 画像はnostr.buildにアップロードして永続化

## データフロー

### タイムライン表示時

```
1. タイムライン読み込み（最大50件）
   ↓
2. 投稿を画面に表示（この時点ではハイライトなし）
   ↓
3. 並行して:
   a. POST /api/wordrot/extract-batch
      - posts: [{ eventId, content }, ...]
      - API側でコンテンツをクリーニング（URL, コード, ハッシュタグ等を除外）
   b. GET /api/wordrot/inventory/:pubkey
      - ユーザーの収集済み単語と画像URLを取得
   ↓
4. extract-batch API側処理:
   - wordrot_event_words テーブルをチェック
   - キャッシュ済み → 即座に返す
   - 未抽出 → コンテンツクリーニング → LLMで名詞抽出（並列3件ずつ）
   - 結果をキャッシュに保存
   ↓
5. レスポンス:
   {
     results: { eventId1: { words: [...], cached: true/false }, ... },
     stats: { total, cached, extracted }
   }
   ↓
6. State更新:
   - 本文内の単語をインラインハイライト
   - 投稿下部に収集済み単語のキャラ画像を表示
```

**表示方式**:

- **インラインハイライト**: 本文中の単語をクリック可能なボタンに変換
- **画像セクション**: 投稿下部に収集済み単語のキャラ画像（32x32）を並べて表示
- 収集済みは緑系、未収集は紫系のスタイル

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

### 単語合成時（Phase 2）

```
1. インベントリのカードをタップ → 数式バーのスロットにセット
   - スロットA（Base）、B（Remove）、C（Add）の3つ
   - 最初はスロットAが選択状態、入力後に次の空きスロットへ自動遷移
   - スロットをタップで解除・再選択可能
   ↓
2. 3スロット全て埋まったら「Synthesize!」ボタンが有効化
   ↓
3. POST /api/wordrot/synthesize
   - pubkey, wordA, wordB, wordC を送信
   ↓
4. API側処理:
   a. 入力バリデーション（pubkey形式、3語存在、ユーザー所有確認）
   b. wordrot_syntheses テーブルでキャッシュチェック
      - キャッシュヒット → use_count++ して即返却
      - キャッシュミス → LLMで演算
   c. LLM演算（Qwen3-30B）: 「A - B + C = ?」を意味的に計算
   d. 結果の単語がDBになければ wordrot_words に作成
   e. 新規単語なら画像生成を非同期キュー（waitUntil）
   f. wordrot_syntheses に合成記録を保存
   g. 結果単語をユーザーのインベントリに追加（source='synthesis'）
   ↓
5. レスポンス:
   {
     result: { id, text, image_url, ... },
     isNewSynthesis: true/false,  // 新しいレシピの発見
     isNewWord: true/false,        // DB上の新規ワード（画像生成対象）
     formula: "マリオ - マリオ + ルイージ = ファイアルイージ"
   }
   ↓
6. クライアント側処理:
   - ユーザーが既に持っていたワードかチェック（合成前のインベントリと比較）
   - isNewWord を上書き: !hadBefore（ユーザーにとっての新規取得）
   ↓
7. 合成演出ポップアップ表示:
   - スーパーノヴァ風のフルスクリーン演出
   - ワードカード（大）を表示
   - isNewWord = true → 「New Wordrot!」タイトル + 「NEW!」バッジ
   - isNewRecipe = true → 「New Recipe!」タイトル + 「New Recipe!」バッジ
   - ポップアップは手動で閉じるまで表示（シェア可能）
   ↓
8. 過去レシピ一覧を表示:
   - APIから最新10件のレシピ（A - B + C）を取得
   - 最新順（discovered_at DESC）でソート → 今回使った式が常に一番上
   - 各レシピの右にスピーカーボタン🔊を配置
   ↓
9. イタリア語読み上げ機能:
   - スピーカーボタンクリック → LLMで式をイタリア語変換
     * A: 所有格（di + 名詞）または関係形容詞（より自然な方）
     * B: 関係形容詞（Aと異なる形）
     * C: 名詞形
   - 例: King - Man + Woman → "Regale Umano Donna"
   - Web Speech API (lang="it-IT") で読み上げ
   - イタリア語変換結果はキャッシュされ、2回目以降は即座に再生
   - 連打対策: 既存の音声を停止してから再生
   - ローディング状態: 再生中はスピナーアイコン表示、他ボタン無効化
   - エラー通知: 変換失敗/TTS非対応時は赤い通知を3秒間表示
   ↓
10. UI更新:
   - インベントリをリロード
   - 数式バーの結果スロット（=の右）をクリックすれば再度ポップアップ表示可能
```

## DBスキーマ

### wordrot_words（単語マスター）

全ユーザー共通の単語辞書。

```sql
CREATE TABLE IF NOT EXISTS wordrot_words (
  id TEXT PRIMARY KEY,           -- UUID
  text TEXT NOT NULL UNIQUE,     -- 単語テキスト（正規化済み）
  image_url TEXT,                -- 生成された画像URL
  image_hash TEXT,               -- SHA-256 hash (NIP-96削除用)
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

合成の組み合わせと結果を記録。同じ組み合わせはキャッシュとして再利用される。

```sql
CREATE TABLE IF NOT EXISTS wordrot_syntheses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_a_id INTEGER NOT NULL,        -- Base word
  word_b_id INTEGER NOT NULL,        -- Word to subtract
  word_c_id INTEGER NOT NULL,        -- Word to add
  result_word_id INTEGER NOT NULL,   -- Result word
  discovered_by TEXT,                -- 最初にこの組み合わせを発見したpubkey
  discovered_at INTEGER NOT NULL,    -- 最後に使用された日時（毎回更新）
  use_count INTEGER DEFAULT 1,       -- 同じ組み合わせが使われた回数
  FOREIGN KEY (word_a_id) REFERENCES wordrot_words(id),
  FOREIGN KEY (word_b_id) REFERENCES wordrot_words(id),
  FOREIGN KEY (word_c_id) REFERENCES wordrot_words(id),
  FOREIGN KEY (result_word_id) REFERENCES wordrot_words(id),
  UNIQUE(word_a_id, word_b_id, word_c_id)
);

CREATE INDEX idx_wordrot_syntheses_result ON wordrot_syntheses(result_word_id);
```

- `UNIQUE(word_a_id, word_b_id, word_c_id)`: 同じ組み合わせの重複防止・キャッシュキー
- キャッシュヒット時は `use_count` をインクリメントし、`discovered_at` を現在時刻に更新
  - これにより、レシピ一覧で「今回使った式が常に一番上」に表示される
- LLM呼び出しをスキップしてパフォーマンス向上

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

### バッチ単語抽出

タイムライン表示時に呼び出す。最大50件まで。

```
POST /api/wordrot/extract-batch
```

リクエスト:

```json
{
  "posts": [
    { "eventId": "abc123", "content": "今日マリオカートで..." },
    { "eventId": "def456", "content": "ルイージ最高！" }
  ]
}
```

レスポンス:

```json
{
  "results": {
    "abc123": { "words": ["今日", "マリオ", "カート"], "cached": false },
    "def456": { "words": ["ルイージ"], "cached": true }
  },
  "stats": {
    "total": 2,
    "cached": 1,
    "extracted": 1
  }
}
```

**注意**: ユーザーの収集済み単語は別途インベントリAPIで取得する。

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
    "id": 123,
    "text": "ルイージ",
    "image_url": "https://nostr.build/yyy.png",
    "image_status": "done",
    "discovered_by": "pubkey...",
    "discovered_at": 1234567890,
    "discovery_count": 5,
    "synthesis_count": 0
  },
  "isNew": true,
  "isFirstEver": false,
  "count": 1
}
```

- `isNew`: このユーザーにとって初めての収集か
- `isFirstEver`: 全ユーザーで初の発見か（発見者になる）
- `count`: このユーザーの収集数

**注意**: 収集済みの単語もクリック可能（重複収集でcount増加）。

### 単語合成

```
POST /api/wordrot/synthesize
```

リクエスト:

```json
{
  "pubkey": "user_pubkey_hex_64chars",
  "wordA": "ファイアマリオ",
  "wordB": "マリオ",
  "wordC": "ルイージ"
}
```

レスポンス（成功）:

```json
{
  "result": {
    "id": 42,
    "text": "ファイアルイージ",
    "image_url": null,
    "image_status": "pending",
    "discovered_by": "pubkey...",
    "discovered_at": 1234567890,
    "discovery_count": 1,
    "synthesis_count": 1
  },
  "isNewSynthesis": true,
  "isNewWord": true,
  "formula": "ファイアマリオ - マリオ + ルイージ = ファイアルイージ"
}
```

- `isNewSynthesis`: この A-B+C の組み合わせが初めてか
- `isNewWord`: 結果の単語がシステム上で新規作成されたか
- `formula`: 人間が読める数式文字列

レスポンス（合成失敗 - LLMが結果を導出できない場合）:

```json
{
  "error": "Synthesis failed - no valid result"
}
```

**エラーケース**:

| ステータス | エラー                                           | 原因                                    |
| ---------- | ------------------------------------------------ | --------------------------------------- |
| 400        | `Invalid pubkey`                                 | pubkeyが64文字hex以外                   |
| 400        | `All three words are required`                   | 3語が揃っていない                       |
| 400        | `One or more words not found in your collection` | 単語がDBに存在しない                    |
| 400        | `You do not own all three words`                 | ユーザーのインベントリにない            |
| 200        | `Synthesis failed - no valid result`             | LLMが`???`を返した / 結果が空・30文字超 |

### レシピ一覧取得

特定のWordrotになった合成レシピを取得する（最新10件）。

```
GET /api/wordrot/recipes/:text
```

パラメータ:

- `text`: Wordrotのテキスト（URLエンコード必須）

レスポンス:

```json
{
  "recipes": [
    {
      "word_a": "King",
      "word_b": "Man",
      "word_c": "Woman",
      "discovered_at": 1234567890
    },
    {
      "word_a": "Emperor",
      "word_b": "Male",
      "word_c": "Female",
      "discovered_at": 1234567880
    }
  ]
}
```

- 最新順（`discovered_at DESC`）でソート
- 最大10件まで返す
- 今回使った式が常に一番上に表示される

### イタリア語変換

合成式（A, B, C）をイタリア語のフレーズに変換する。読み上げ機能で使用。

```
POST /api/wordrot/italian
```

リクエスト:

```json
{
  "wordA": "King",
  "wordB": "Man",
  "wordC": "Woman"
}
```

レスポンス:

```json
{
  "a": "Regale",
  "b": "Umano",
  "c": "Donna"
}
```

- **A**: 所有格（di + 名詞）または関係形容詞（より自然な方）
- **B**: 関係形容詞（Aと異なる形）
- **C**: 名詞形
- LLMが自動判定し、最も自然なイタリア語に変換
- 読み上げ時は "Regale Umano Donna" のように連結

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
  ]
}
```

## UI仕様

### タイムライン上のハイライト表示

投稿本文内の収集可能な単語をインラインでハイライト表示する。

**未収集の単語**:

- 背景: 紫系グラデーション（rgba(139, 92, 246, 0.15)）
- 下線: 紫系（text-decoration-color）
- ホバー時: 背景色が濃くなる
- カーソル: pointer

**収集済みの単語**:

- 背景: 緑系グラデーション（rgba(34, 197, 94, 0.15)）
- 下線: 緑系
- クリック可能（再収集でカウント増加）
- カーソル: pointer

**ハイライト対象外**:

- リンク（`<a>`タグ内）
- コードブロック・インラインコード（`<code>`, `<pre>`タグ内）
- 既存のボタン（ハッシュタグ、メンション等）
- 画像、音声、動画

```
┌─────────────────────────────────────────────────────┐
│ 投稿本文:                                           │
│                                                     │
│ 今日[マリオ][カート]で[ルイージ]使って              │
│ [スター]取った！                                    │
│                                                     │
│ [紫背景] = 未収集                                   │
│ [緑背景] = 収集済み                                 │
├─────────────────────────────────────────────────────┤
│ [🎮][🏎️][👤][⭐]  ← 収集済み単語のキャラ画像(32x32) │
└─────────────────────────────────────────────────────┘
```

### キャラクター画像セクション

投稿下部に収集済み単語のキャラクター画像を小さく表示。

- サイズ: 32x32px
- ホバー時: scale(1.1) + 影
- クリック: 収集カウント増加 + 演出

### 収集モーダル

単語クリック時に表示する収集演出。

```
┌────────────────────────────────────┐
│                                    │
│         [単語の画像]               │
│          (128x128)                 │
│                                    │
│           **カート**               │
│             GET!                   │
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
│ Words (8 types)          ← ワード＝収集した素材     │
│                                                     │
│ [img] [img] [img] [img] [img] [img]  ← タップで    │
│ マリオ ルイージ  スター  キノコ  ...    スロットに入る│
│                                                     │
│ [img] [img]                                        │
│ カート  ファイア                                    │
│                                                     │
┌─────────────────────────────────────────────────────┐
│ ┌──┐   ┌──┐   ┌──┐   ┌──┐  ← 数式バー（黒枠2px） │
│ │A │ - │B │ + │C │ = │? │                          │
│ └──┘   └──┘   └──┘   └──┘                          │
│                                                     │
│    合成前: [Clear] [Synthesize!]                    │
│    合成後: [New Synthesis]                          │
└─────────────────────────────────────────────────────┘
│                                                     │
│ [FlaskConical] Wordrot (4) ← 合成で生まれたもの    │
│ Wordrot cannot be used as synthesis materials.     │
│                                                     │
│ [img] [img] [img] [img]                            │
│ ファイア  フロスト  ...   ← クリック不可（閲覧のみ） │
│ ルイージ  ドラゴン                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**合成UIの操作フロー**:

1. スロットAが初期選択状態（紫ハイライト枠）
2. **ワード（Wordsセクション）**のカードをタップ → 選択中スロットにワードが入る
3. 入ったら次の空きスロットが自動的に選択状態になる
4. スロットを直接タップ → そのスロットを選択状態に変更
5. 既に入っているスロットをタップ → ワードを解除し、そのスロットが選択状態に
6. 同じワードを複数スロットに入れることはできない（重複防止ガード）
7. **ワードロット（Wordrotセクション）**のカードはクリック不可（合成素材にできない）
8. 3つ揃うと「Synthesize!」ボタンが紫にハイライトして有効化
9. 合成実行 → スーパーノヴァ風のフルスクリーン演出ポップアップが表示
10. ポップアップには以下を表示:

- ワードカード（大サイズ）
- レシピ式（A - B + C = Result）
- バッジ（NEW! または New Recipe!）
- タイトル（New Wordrot! / New Recipe! / Synthesis Complete!）

11. ポップアップは手動で閉じるまで表示（タップ or Escキー）→ シェア可能
12. ポップアップを閉じると数式バーの結果スロット（=の右）にカード表示
13. 結果スロットをクリックすればいつでもポップアップを再表示可能
14. 合成後は「New Synthesis」ボタン1つに変わり、押すとスロット全クリア＋結果クリア

**「NEW!」の判定ロジック**:

- **ユーザー視点**: そのユーザーが初めて取得したワードロットかどうか
- クライアント側で判定: 合成前のインベントリに存在しなければ「NEW!」
- APIの`isNewWord`は画像生成判定用（DB上の新規ワード）
- 全ユーザーでの初回かどうかは考慮しない（すべてが新鮮に見える方がシェア意欲向上）

**表示の分離**:

- Words（ワード）セクション: 投稿から収集した素材。合成バーの上に表示。FlaskConicalアイコンなし。**合成素材として使用可能**。
- Wordrot（ワードロット）セクション: 合成で生まれた単語。合成バーの下に表示。FlaskConicalアイコン付き。**合成素材としては使用不可**（閲覧のみ）。

### ワードカード（WordCard）

個々のワード / ワードロットを表示するカードコンポーネント。

```
┌──────────┐
│  [画像]  │  64x64 または 48x48
│          │
│  単語名  │  テキスト（ellipsis省略、ホバーでフル表示）
└──────────┘
```

**状態による表示**:

- 通常: 透明枠、白背景
- ホバー: 影が付く
- 選択中（合成スロットにセット済み）: 紫枠、薄紫背景

**テキスト表示**:

- テキスト幅は画像幅に合わせて制約（normal: 64px、small: 48px、large: 96px）
- 溢れる場合は `text-overflow: ellipsis` で省略
- `title` 属性によりホバーでフルネーム表示

### 合成演出ポップアップ（WordSynthesisCelebration）

合成成功時に表示されるフルスクリーン演出モーダル。スーパーノヴァ取得時と同様のデザイン。

```
┌─────────────────────────────────────────────────┐
│                                                 │
│     ✨✨✨ (20個のスパークルパーティクル)        │
│                                                 │
│           [FlaskConical]                        │
│         (グローエフェクト付き)                   │
│                                                 │
│         New Wordrot!                            │
│         (または New Recipe! / Synthesis Complete!)│
│                                                 │
│     ┌────────────────┐                          │
│     │                │                          │
│     │  [ワード画像]  │  (大サイズカード)         │
│     │                │                          │
│     │   単語テキスト │                          │
│     └────────────────┘                          │
│                                                 │
│     マリオ - マリオ + ルイージ = ファイアルイージ│
│     (レシピ式)                                  │
│                                                 │
│     ┌──────────┐                                │
│     │ ✨ NEW!  │  (isNewWord = true の場合)    │
│     └──────────┘                                │
│     または                                      │
│     ┌────────────────┐                          │
│     │ ⭐ New Recipe! │  (isNewRecipe = true)   │
│     └────────────────┘                          │
│                                                 │
│     Tap anywhere to continue                    │
│                                                 │
└─────────────────────────────────────────────────┘
```

**表示タイミング**:

- 合成実行直後（自動表示）
- 結果スロット（=の右）クリック時（手動表示）

**閉じる方法**:

- 背景タップ
- Escキー
- 自動では閉じない（シェアのため）

**バッジとタイトルの組み合わせ**:

| 条件               | タイトル            | バッジ         | 説明                                 |
| ------------------ | ------------------- | -------------- | ------------------------------------ |
| isNewWord = true   | New Wordrot!        | ✨ NEW!        | ユーザーが初めて取得したワードロット |
| isNewRecipe = true | New Recipe!         | ⭐ New Recipe! | 新しいレシピを発見（既存ワードでも） |
| それ以外           | Synthesis Complete! | なし           | 既知のレシピで既存ワードを再取得     |

**演出の詳細**:

- 背景: 半透明黒（opacity: 0.85）
- スパークルパーティクル: ランダム配置、フェードアニメーション
- コンテンツ: scale(0.8) → scale(1) のバウンスアニメーション
- アイコン: パルスグロー（2秒周期）
- z-index: 10000（最前面）

## アクセシビリティ

### 色に依存しない識別

色覚異常のユーザーでも区別できるよう、色と下線スタイルで区別する。

**未収集 vs 収集済み**:

- 未収集: 紫系グラデーション背景 + 紫下線
- 収集済み: 緑系グラデーション背景 + 緑下線

**title属性**:

- 未収集: `Collect: {単語}`
- 収集済み: `{単語} (collected)`

ホバーでツールチップが表示され、視覚的な色の区別が困難でも状態を確認可能。

### コントラスト

- ハイライト背景色は十分なコントラスト比を確保
- テキストは常に読みやすい色
- ダークモードでも同様の区別が可能

## LLM処理

### 名詞抽出（Phase 1）

Workers AI (LLaMA 3.1 8B) を使用。

#### コンテンツクリーニング

LLMに渡す前に、ハイライト対象外の要素を除去する:

````typescript
// 除去対象（抽出もハイライトもしない）
- コードブロック (```...```)
- インラインコード (`...`)
- URL (https://...)
- nostr:メンション (nostr:npub..., nostr:note...)
- ハッシュタグ (#tag)
````

これにより、URLやコード内の文字列から誤って単語を抽出することを防ぐ。

#### 最小マッチ戦略

複合語は最小の意味単位に分割する:

- 「マリオカート」→ ["マリオ", "カート"]
- 「ファイアマリオ」→ ["ファイア", "マリオ"]
- 「スーパーキノコ」→ ["スーパー", "キノコ"]

これにより収集可能な単語が増え、合成の自由度が高まる。

#### プロンプト

```
以下のテキストから名詞を抽出してください。

ルール:
1. 複合語は最小の意味単位に分割する
   例: 「マリオカート」→ "マリオ", "カート"
   例: 「ファイアマリオ」→ "ファイア", "マリオ"
2. 固有名詞、一般名詞のみ抽出
3. 動詞、形容詞、助詞、接続詞は除外
4. JSON配列形式で出力

テキスト: 今日マリオカートでルイージ使ってスター取った！

出力: ["今日", "マリオ", "カート", "ルイージ", "スター"]
```

### 単語合成（Phase 2）

Workers AI (Qwen3-30B-A3B-FP8) を使用。

#### プロンプト

```
あなたは単語のベクトル演算を行う専門家です。

Word2Vecのように、単語を意味空間のベクトルとして扱います。
A－B＋C は「AからBの意味成分を引き、Cの意味成分を足す」演算です。

【演算】
「{wordA}」 － 「{wordB}」 ＋ 「{wordC}」 ＝ ？

【参考例】
- 「キング」－「マン」＋「ウーマン」＝「クイーン」（性別の軸を入れ替え）
- 「アイスコーヒー」－「コーヒー」＋「ティー」＝「アイスティー」（飲料の種類を入れ替え）
- 「ファイアマリオ」－「マリオ」＋「ルイージ」＝「ファイアルイージ」（キャラの軸を入れ替え）
- 「ドラゴン」－「ファイア」＋「アイス」＝「フロストドラゴン」（属性の軸を入れ替え）
- 「スシ」－「ジャパン」＋「イタリア」＝「ピッツァ」（文化圏の軸を入れ替え）
- 「ライオン」－「サバンナ」＋「オーシャン」＝「シャーク」（生息域の軸を入れ替え）

【ルール】
1. 結果は1つの名詞または複合語のみ（カタカナまたは英語）
2. AとBの関係性を見抜き、同じ関係性でCに対応する語を導出
3. 存在しない造語も可（ファイアルイージ、フロストドラゴンなど）
4. 結果が導出できない場合のみ「???」を返す
5. 余計な説明は不要、結果の単語のみを出力

【出力】
結果の単語のみを出力してください（「」は不要）:
```

**パラメータ**:

- `max_tokens: 100`（結果の単語のみなので短い）
- `/no_think` フラグでQwen3のreasoning出力を抑制

**結果クリーニング**:

- `<think>...</think>` タグを除去
- `結果：`、`答え：`、`出力：`、`回答：` 等の接頭辞を除去
- 各種引用符（`「」『』""''""`）を除去
- 末尾の句読点（`。．.！!？?`）を除去
- 結果が `???`、空、30文字超の場合は失敗扱い

#### キャッシュ戦略

- 同じ `(wordA, wordB, wordC)` の組み合わせは `wordrot_syntheses` テーブルに保存
- 2回目以降は LLM を呼ばず、キャッシュから結果を返す（`use_count++`）
- これにより同じ演算のコストが 0 に

### 画像生成（Phase 1 + Phase 2）

Workers AI (FLUX.1-Schnell) を使用。2段階プロンプト方式。

#### Step 1: 単語 → 英語の視覚描写（LLM: Qwen3-30B）

単語を3-8語の英語フレーズに変換する。ワード（Word）とワードロット（Wordrot）で描写方針が異なる。

**ワード（収集した素材）**: 物体のアイコンとして描写

```
- Foods → the food: "a bright red bell pepper"
- Objects → the object: "a silver metallic robot"
- Animals → the animal: "a blue and white dolphin"
- 背景が黄色のため、黄/橙/金は避ける
```

**ワードロット（合成結果）**: 可愛い丸い生物として描写

```
- Foods → cute creature: "a round red apple buddy with big eyes"
- Objects → adorable pet: "a silver round robot-shaped pet"
- Animals → cute round version: "a puffy blue baby dolphin"
- Never scary, never humanoid. Always round, squishy, friendly.
- 背景が黄緑のため、緑/ライムは避ける
```

#### Step 2: 描写 → 画像生成（FLUX.1-Schnell, 8 steps）

**ワード（Word）**: 黄色背景の物体アイコン

```
Extreme close-up 16-bit pixel art of {description}, filling the entire frame.
Flat solid golden yellow (#F1C40F) background, nothing else behind the subject.
One single subject, very large, zoomed in, touching all four edges of the image.
Retro SNES game sprite style, bold outlines, vibrant saturated colors that contrast against yellow.
No text, no letters, no words, no border, no frame, no grid, no pattern, no multiple copies.
```

**ワードロット（Wordrot）**: 黄緑背景の可愛い生物

```
Extreme close-up 16-bit pixel art of {description}, filling the entire frame.
Flat solid yellow-green (#8BC34A) background, nothing else behind the subject.
One single subject, very large, zoomed in, touching all four edges of the image.
The subject should look like a cute, round, small living creature — with big friendly eyes,
soft body, like a Kirby or Slime. Not humanoid, not scary. Adorable and squishy.
Retro SNES game sprite style, bold outlines, vibrant saturated colors that contrast against yellow-green.
No text, no letters, no words, no border, no frame, no grid, no pattern, no multiple copies.
```

**背景色による階層設計**:

| 種別                    | 背景色          | 絵柄         | 意図             |
| ----------------------- | --------------- | ------------ | ---------------- |
| ステラ                  | 黄色            | -            | 基盤通貨         |
| ワード（Word）          | 黄色（#F1C40F） | 物体アイコン | 収集素材         |
| ワードロット（Wordrot） | 黄緑（#8BC34A） | 可愛い生物   | 合成結果         |
| 将来の再合成            | 緑系統（予定）  | TBD          | さらなる合成の種 |

#### アップロード

[NIP-96](https://github.com/nostr-protocol/nips/blob/master/96.md)準拠でnostr.buildにアップロード。

**認証**:

- NPC Uploaderアカウントの秘密鍵（環境変数 `UPLOADER_NSEC`）を使用
- NIP-98でAuthorization headerを生成
- ユーザーのnsecは使用しない（サーバーサイドで処理するため）

```bash
# Cloudflare Workers secrets として設定
wrangler secret put UPLOADER_NSEC
# → nsec形式（bech32）の秘密鍵を入力
```

**削除用情報の保持**:

- アップロード成功時、`image_hash`（SHA-256）を`wordrot_words`テーブルに保存
- 失敗時やリトライ時に古い画像を削除可能

```sql
-- wordrot_words テーブルに追加
image_hash TEXT,  -- SHA-256 hash for NIP-96 delete
```

**エラーハンドリング**:

1. 生成失敗 → `image_status = 'failed'`、リトライキューへ
2. アップロード失敗 → 生成済み画像は破棄、リトライキューへ
3. 成功 → `image_url`と`image_hash`を保存、`image_status = 'done'`

## 運用

### レート制限

**ユーザー → Worker API**:

- Cloudflare Rate Limiting で設定
- 目安: 1分100リクエスト/IP
- 超過時は `429 Too Many Requests`

**Worker → Workers AI（LLM/画像生成）**:

- 制限はCloudflare側で管理（自前カウント不要）
- エラー時は失敗として記録、Cronでリトライ

### エラーハンドリング

**バッチAPI失敗時**:

- キャッシュ済みの結果のみ返す
- 未抽出の投稿はハイライトなし
- 静かに失敗（トースト通知なし）

**収集API失敗時**:

- トースト通知でエラー表示
- ユーザーは再度クリックで再試行可能

**合成API失敗時**:

- バリデーションエラー（400）→ 数式バー内にエラーメッセージ表示
- LLM演算失敗（200, `error` のみ）→ 「Synthesis failed」表示
- ネットワークエラー → 「Network error」表示
- いずれの場合もスロットは保持され、再試行可能

**Workers AI エラー時**:

1. `image_status = 'failed'` に更新
2. Cronジョブが定期的にリトライ
3. 成功するまで繰り返す

### 画像生成キュー処理

Cronジョブ（1分ごと）:

1. `wordrot_image_queue` から `status = 'pending'` を取得
2. 1回の実行で最大10件処理
3. Workers AIでエラー → `attempts++`、次回リトライ
4. 成功 → `wordrot_words` 更新、キューから削除

### エッジケース

| ケース                 | 対応                 |
| ---------------------- | -------------------- |
| 単語0件の投稿          | 空配列を返す（正常） |
| 長い単語（20文字超）   | 20文字で切り捨て     |
| 不正文字（制御文字等） | サニタイズして除去   |

### プレースホルダー表示

画像生成中（`image_status != 'done'`）の単語:

- 単語の頭文字を大きく表示（例: 「マ」）
- 背景色はパステル（ランダムまたはハッシュベース）
- 画像取得後に差し替え

### クライアント側キャッシュ

セッション中のみメモリキャッシュ（リロードでクリア）:

- `eventId → 単語配列` のマップ
- `単語テキスト → 画像URL` のマップ
- `collected` セット（収集済み単語）

同じタイムラインを行き来しても再リクエストしない。

## 今後の拡張候補

- 単語のレアリティシステム（出現頻度に基づく）
- 合成履歴の公開（誰がどんな単語を生み出したか）
- 単語図鑑のコンプリート要素
- 特定の合成でSupernova解除
- 単語トレード機能

## ファイル構成

### Phase 1

```
apps/api/src/routes/wordrot.ts           # APIエンドポイント

apps/web/src/hooks/wordrot/
  ├── index.ts
  ├── useWordrot.ts                      # 単語収集・インベントリ
  └── useWordrotTimeline.ts              # タイムライン統合（抽出/キャッシュ/画像）

apps/web/src/components/wordrot/
  ├── index.ts
  ├── WordrotProvider.tsx                # Contextプロバイダー
  ├── WordCollectCelebration.tsx         # 収集演出モーダル（トースト風）
  ├── WordSynthesisCelebration.tsx       # 合成演出ポップアップ（フルスクリーン）
  └── WordHighlight.tsx                  # (未使用: インラインは parser で処理)

apps/web/src/lib/parser/
  ├── html-utils.ts                      # processWordHighlights()
  └── callbacks.ts                       # wordrotクリックハンドラー

apps/web/src/styles/components/
  ├── word-highlight.css                 # ハイライト + 画像セクション
  ├── word-collect-celebration.css       # 収集演出（トースト風）
  └── word-synthesis-celebration.css     # 合成演出（フルスクリーン）
```

### Phase 2（合成機能）

```
apps/web/src/hooks/wordrot/useSynthesis.ts          # 合成状態管理hook
apps/web/src/components/wordrot/SynthesisPanel.tsx  # 数式バーUI（下部固定）
apps/web/src/components/wordrot/WordSynthesisCelebration.tsx # 合成演出ポップアップ
apps/web/src/styles/components/synthesis-panel.css # 数式バースタイル
apps/web/src/styles/components/word-synthesis-celebration.css # 合成演出スタイル
apps/web/src/lib/api/api.ts                         # synthesizeWords() クライアント関数
```

**主要コンポーネント**:

- `WordCollectCelebration`: 投稿からワード収集時のトースト演出（小さめ、2秒表示後INVに飛ぶ）
- `WordSynthesisCelebration`: 合成成功時のフルスクリーン演出（手動で閉じるまで表示）
- `SynthesisPanel`: 数式バー（A - B + C = ? の入力UI）
- `WordCard`: ワード/ワードロットのカード表示（3サイズ: small/normal/large）

[← 拡張仕様一覧に戻る](./index.md)
