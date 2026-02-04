# Wordrot（ワードロット）

投稿から名詞を収集し、Word2Vecのようなベクトル演算で新しい単語を合成する機能。
「言葉が腐る」= brainrot的な美学で、変な結果も楽しむコレクション要素。

## フェーズ

| フェーズ | 内容 | 状態 |
|---------|------|------|
| Phase 1 | 単語収集（タイムラインハイライト、クリック収集、インベントリ） | 実装対象 |
| Phase 2 | 単語合成（A + B = ? または A - B + C = ?） | 後日 |

## 背景

- Word2Vecの有名な例: 「王様 - 男 + 女 = 女王」
- ゲーム的な例: 「ファイアマリオ - マリオ + ルイージ = ファイアルイージ」
- タイムライン上の投稿から名詞を見つけてクリックで収集
- 収集した単語を使って合成を楽しむ（Phase 2）
- 単語ごとにAI生成のキャラクター画像が付く（ドット絵/2頭身）

## コンセプト

### 収集の楽しさ（Phase 1）

- タイムラインを眺めているだけで「お、この単語まだ持ってない」と気づく
- クリックして収集 → ゲットした感覚
- 同じ単語は1回のみ収集可能（重複なし）
- レアな単語、変な単語を見つける喜び

### 合成の楽しさ（Phase 2）

- 単語を組み合わせて新しい単語を生み出す
- 足し算のみ（A + B = ?）または引き算も（A - B + C = ?）は後日検討
- 結果はLLMが意味的に計算（ベクトル演算的な動作）
- 変な結果が出ても「brainrot」として楽しむ
- 新しい単語を最初に生み出した人は「発見者」

### 画像生成（Phase 1）

- 単語が初めてシステムに登録されたとき、AI画像を生成
- 統一フォーマット: 正方形、ドット絵または2頭身キャラ
- 変な絵でも「味がある」として受け入れる美学
- 画像はnostr.buildにアップロードして永続化

## データフロー（Phase 1）

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

### 単語合成時（Phase 2）

> Phase 2で実装予定。足し算のみ（A + B = ?）にするか、引き算も含める（A - B + C = ?）かは後日検討。

```
1. ユーザーがスロットに単語をセット
   ↓
2. POST /api/wordrot/synthesize
   ↓
3. API側処理:
   - LLMに演算を計算させる
   - 結果の単語がDBになければ作成
   - wordrot_syntheses に合成記録
   ↓
4. レスポンス: 結果の単語
```

## DBスキーマ（Phase 1）

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

### wordrot_syntheses（合成記録）【Phase 2】

> Phase 2で実装予定。スキーマは合成仕様確定後に決定。

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

## API仕様（Phase 1）

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
    "abc123": ["今日", "マリオ", "カート"],
    "def456": ["ルイージ"]
  },
  "collected": ["マリオ"],
  "wordImages": {
    "マリオ": "https://nostr.build/xxx.png",
    "カート": "https://nostr.build/yyy.png",
    "ルイージ": "https://nostr.build/zzz.png"
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

### 単語合成【Phase 2】

> Phase 2で実装予定。API仕様は合成方式確定後に決定。

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

## UI仕様（Phase 1）

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
│ 今日[v マリオ][*カート]で[v ルイージ]使って         │
│ [*スター]取った！                                   │
│                                                     │
│ [*] = 未収集（目立つ、クリック可能）                │
│ [v] = 収集済み（控えめ、クリック不可）              │
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
│ Word Collection                                     │
│                                                     │
│ [img] [img] [img] [img] [img] [img]                │
│ マリオ ルイージ  スター  キノコ  ...                │
│                                                     │
│ [img] [img] [img] [img] [img] [img]                │
│ カート  ファイア  ...                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

> 合成UIはPhase 2で追加予定。

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
- ホバー: 影が付く
- 選択中（Phase 2 合成スロット用）: 紫枠、薄紫背景

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

### 名詞抽出（Phase 1）

Workers AI (LLaMA 3.1 8B) を使用。

**最小マッチ戦略**: 複合語は最小の意味単位に分割する。
- 「マリオカート」→ ["マリオ", "カート"]
- 「ファイアマリオ」→ ["ファイア", "マリオ"]
- 「スーパーキノコ」→ ["スーパー", "キノコ"]

これにより収集可能な単語が増え、合成の自由度が高まる。

プロンプト例:

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

### 単語合成【Phase 2】

> Phase 2で実装予定。

### 画像生成（Phase 1）

Workers AI (Stable Diffusion XL) を使用。

#### プロンプト

すべての単語をキャラクター化する（抽象概念でも無理やりキャラにするのが面白い）。

```
{word} as a cute chibi character,
2-head-tall proportions, pixel art style,
simple pastel background, game sprite,
facing forward, full body, centered
```

**指定のポイント**:
- `chibi`: 2頭身のデフォルメキャラ
- `pixel art style`: ドット絵風
- `pastel background`: 淡い背景色
- `game sprite`: ゲームのキャラっぽく
- `full body, centered`: 全身、中央配置

> プロンプトは英語。Stable Diffusionは英語プロンプトの方が品質が高い。
> 日本語の単語もそのまま渡す（例: `マリオ as a cute chibi character...`）。

#### アップロード

[NIP-96](https://github.com/nostr-protocol/nips/blob/master/96.md)準拠でnostr.buildにアップロード。

**認証**:
- アプリ専用のnsec（環境変数 `WORDROT_NSEC`）を使用
- NIP-98でAuthorization headerを生成
- ユーザーのnsecは使用しない（サーバーサイドで処理するため）

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

## 今後の拡張候補

- 単語のレアリティシステム（出現頻度に基づく）
- 合成履歴の公開（誰がどんな単語を生み出したか）
- 単語図鑑のコンプリート要素
- 特定の合成でSupernova解除
- 単語トレード機能

## ファイル構成

### Phase 1

```
apps/api/src/routes/wordrot.ts       # APIエンドポイント
apps/web/src/hooks/wordrot/
  ├── index.ts
  └── useWordrot.ts                  # 収集・インベントリ
apps/web/src/components/wordrot/
  ├── index.ts
  ├── WordCard.tsx                   # 単語カード
  ├── WordHighlight.tsx              # 本文内ハイライト
  └── CollectCelebration.tsx         # 収集演出モーダル
apps/web/src/styles/components/
  ├── word-card.css
  ├── word-highlight.css
  └── collect-celebration.css
```

### Phase 2（後日追加）

```
apps/web/src/hooks/wordrot/useSynthesis.ts
apps/web/src/components/wordrot/SynthesisPanel.tsx
apps/web/src/styles/components/synthesis-panel.css
```

[← 拡張仕様一覧に戻る](./index.md)
