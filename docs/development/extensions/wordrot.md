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

```typescript
// 除去対象（抽出もハイライトもしない）
- コードブロック (```...```)
- インラインコード (`...`)
- URL (https://...)
- nostr:メンション (nostr:npub..., nostr:note...)
- ハッシュタグ (#tag)
```

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

| ケース | 対応 |
|--------|------|
| 単語0件の投稿 | 空配列を返す（正常） |
| 長い単語（20文字超） | 20文字で切り捨て |
| 不正文字（制御文字等） | サニタイズして除去 |

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
  ├── WordCollectCelebration.tsx         # 収集演出モーダル
  └── WordHighlight.tsx                  # (未使用: インラインは parser で処理)

apps/web/src/lib/parser/
  ├── html-utils.ts                      # processWordHighlights()
  └── callbacks.ts                       # wordrotクリックハンドラー

apps/web/src/styles/components/
  ├── word-highlight.css                 # ハイライト + 画像セクション
  └── word-collect-celebration.css       # 収集演出
```

### Phase 2（後日追加）

```
apps/web/src/hooks/wordrot/useSynthesis.ts
apps/web/src/components/wordrot/SynthesisPanel.tsx
apps/web/src/styles/components/synthesis-panel.css
```

[← 拡張仕様一覧に戻る](./index.md)
