# ワード錬金術（Word Alchemy）設計書

> 投稿から名詞を収集し、足し引きで新しい概念を合成するゲーミフィケーション機能

---

## コンセプト

```
「ファイアマリオ」 － 「マリオ」 ＋ 「ルイージ」 ＝ 「ファイアルイージ」
```

Word2Vecのベクトル演算をLLMで再現。人間がベクトルを管理するのではなく、LLMが文脈から判断する。

### ブレインロット美学

- 新しい単語が発見されると、AIが自動で画像生成
- 変な絵でもみんなで楽しむ
- 正方形・2頭身・ドット絵風で統一

---

## ユーザーフロー

### 1. 収穫（Harvest）

```
タイムラインを読む
  ↓
投稿内の「収集可能な名詞」がハイライト表示
  ✨マリオ✨ が冒険に出かけた
  ↓
ハイライトをクリック
  ↓
🎉 ゲット演出 + インベントリに追加
```

### 2. 合成（Synthesis）

```
インベントリ画面で「合成」タブを選択
  ↓
3つのスロットに単語をドラッグ
  [ A ] － [ B ] ＋ [ C ] ＝ ？
  ↓
「錬金する」ボタン
  ↓
LLMが結果を計算
  ↓
結果表示 + コレクションに追加
（新発見なら画像生成 + 全体共有）
```

---

## 技術スタック

| 用途 | 技術 |
|------|------|
| 名詞抽出 | Cloudflare Workers AI (LLaMA 3) |
| 合成判定 | Cloudflare Workers AI (LLaMA 3) |
| 画像生成 | Cloudflare Workers AI (Stable Diffusion XL) |
| 画像ホスト | nostr.build API |
| データ保存 | Cloudflare D1 |
| キャッシュ | D1 + メモリ |

### Workers AIモデル

```typescript
// テキスト生成
const model = '@cf/meta/llama-3.1-8b-instruct'

// 画像生成
const imageModel = '@cf/stabilityai/stable-diffusion-xl-base-1.0'
```

---

## データベース設計

### words テーブル（単語マスタ）

```sql
CREATE TABLE words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL UNIQUE,           -- 単語テキスト
  image_url TEXT,                       -- nostr.buildの画像URL
  discovered_by TEXT,                   -- 最初に発見したpubkey
  discovered_at INTEGER NOT NULL,       -- 発見日時（Unix timestamp）
  discovery_count INTEGER DEFAULT 1,    -- 総発見回数
  synthesis_count INTEGER DEFAULT 0,    -- 合成で生成された回数
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_words_text ON words(text);
```

### user_words テーブル（ユーザーのコレクション）

```sql
CREATE TABLE user_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pubkey TEXT NOT NULL,
  word_id INTEGER NOT NULL,
  count INTEGER DEFAULT 1,              -- 所持数
  first_collected_at INTEGER NOT NULL,
  last_collected_at INTEGER NOT NULL,
  source TEXT DEFAULT 'harvest',        -- 'harvest' | 'synthesis'
  FOREIGN KEY (word_id) REFERENCES words(id),
  UNIQUE(pubkey, word_id)
);

CREATE INDEX idx_user_words_pubkey ON user_words(pubkey);
```

### syntheses テーブル（合成履歴）

```sql
CREATE TABLE syntheses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word_a_id INTEGER NOT NULL,           -- 基準の単語
  word_b_id INTEGER NOT NULL,           -- 引く単語
  word_c_id INTEGER NOT NULL,           -- 足す単語
  result_word_id INTEGER NOT NULL,      -- 結果の単語
  discovered_by TEXT,                   -- 最初にこの組み合わせを発見したpubkey
  discovered_at INTEGER NOT NULL,
  use_count INTEGER DEFAULT 1,          -- この組み合わせの使用回数
  FOREIGN KEY (word_a_id) REFERENCES words(id),
  FOREIGN KEY (word_b_id) REFERENCES words(id),
  FOREIGN KEY (word_c_id) REFERENCES words(id),
  FOREIGN KEY (result_word_id) REFERENCES words(id),
  UNIQUE(word_a_id, word_b_id, word_c_id)
);
```

### event_words テーブル（投稿の名詞キャッシュ）

```sql
CREATE TABLE event_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL UNIQUE,        -- Nostrイベントのid
  words_json TEXT NOT NULL,             -- JSON配列 ["マリオ", "冒険", ...]
  analyzed_at INTEGER NOT NULL
);

CREATE INDEX idx_event_words_event_id ON event_words(event_id);
```

---

## API設計

### 名詞抽出

```
POST /api/alchemy/extract
Body: { eventId: string, content: string }
Response: { words: string[] }
```

投稿テキストから収集可能な名詞を抽出。結果はキャッシュ。

### 単語ゲット

```
POST /api/alchemy/collect
Body: { pubkey: string, word: string, eventId: string }
Response: {
  word: Word,
  isNew: boolean,        // このユーザーにとって新規か
  isFirstEver: boolean,  // 全体で初発見か（画像生成トリガー）
  count: number          // 所持数
}
```

### 合成

```
POST /api/alchemy/synthesize
Body: {
  pubkey: string,
  wordA: string,  // 基準
  wordB: string,  // 引く
  wordC: string   // 足す
}
Response: {
  result: Word,
  isNewSynthesis: boolean,  // この組み合わせが初か
  isNewWord: boolean        // 結果の単語が新規か
}
```

### インベントリ取得

```
GET /api/alchemy/inventory/{pubkey}
Response: {
  words: [{
    word: Word,
    count: number,
    firstCollectedAt: number
  }],
  totalCount: number,
  uniqueCount: number
}
```

### 単語詳細

```
GET /api/alchemy/word/{text}
Response: {
  word: Word,
  synthesesAsResult: Synthesis[],  // この単語が結果になる合成
  synthesesAsInput: Synthesis[]    // この単語を使う合成
}
```

---

## LLMプロンプト設計

### 名詞抽出プロンプト

```
以下のテキストから、収集対象となる「名詞」を抽出してください。

対象とする名詞:
- 具体的な物（りんご、車、本）
- キャラクター名（マリオ、ピカチュウ）
- 概念（愛、勇気、魔法）
- 場所（東京、城、森）

対象としない名詞:
- 代名詞（これ、それ、私）
- 一般的すぎる語（もの、こと、人）
- 助数詞（個、人、回）

テキスト:
「{content}」

JSON配列形式で出力してください:
["名詞1", "名詞2", ...]
```

### 合成プロンプト

```
単語のベクトル演算を行います。

演算: 「{wordA}」 － 「{wordB}」 ＋ 「{wordC}」 ＝ ？

例:
- 「ファイアマリオ」－「マリオ」＋「ルイージ」＝「ファイアルイージ」
- 「王様」－「男」＋「女」＝「女王」
- 「東京」－「日本」＋「フランス」＝「パリ」

ルール:
1. 結果は1つの名詞または複合語
2. 意味的な関係性を考慮して導出
3. 存在しない造語も可（ファイアルイージなど）
4. 結果が導出できない場合は "???" を返す

結果のみを出力してください:
```

### 画像生成プロンプト

```
A cute chibi pixel art character of "{word}",
square format,
simple background,
2-head-tall proportions,
16-bit retro game style,
vibrant colors
```

---

## フロントエンド設計

### 投稿内ハイライト

```tsx
// PostContent.tsx に追加
const highlightWords = (content: string, collectableWords: string[]) => {
  // 収集可能な単語をハイライト表示
  // クリックで収集処理を発火
}
```

### ゲット演出

```tsx
// WordCollectCelebration.tsx
// 単語ゲット時のモーダル
// - 単語の画像表示（あれば）
// - キラキラエフェクト
// - 所持数表示
// - 「NEW!」バッジ（初回）
```

### インベントリUI

```tsx
// InventoryPage.tsx の新タブ
// 「ワード」タブを追加
// - グリッド表示（正方形画像）
// - 所持数バッジ
// - ソート（名前順、入手順、所持数順）
// - 合成ボタン
```

### 合成UI

```tsx
// SynthesisModal.tsx
// 3スロットの合成画面
// - ドラッグ&ドロップ
// - クリックで選択
// - 結果プレビュー（既知の組み合わせなら）
// - 錬金ボタン
```

---

## 画像生成フロー

```
新しい単語が発見される
  ↓
Workers AIでSD-XL画像生成
  ↓
画像をBase64で取得
  ↓
nostr.build APIにアップロード
  POST https://nostr.build/api/v2/upload/files
  ↓
返却されたURLをDBに保存
  ↓
フロントエンドに画像URL返却
```

### nostr.build アップロード

```typescript
const uploadToNostrBuild = async (imageBase64: string): Promise<string> => {
  const formData = new FormData()
  const blob = base64ToBlob(imageBase64, 'image/png')
  formData.append('file', blob, 'word.png')

  const response = await fetch('https://nostr.build/api/v2/upload/files', {
    method: 'POST',
    body: formData
  })

  const result = await response.json()
  return result.data[0].url
}
```

---

## コスト試算

### Cloudflare Workers AI

| 操作 | モデル | 料金 |
|------|--------|------|
| 名詞抽出 | LLaMA 3.1 8B | $0.011/1M tokens |
| 合成判定 | LLaMA 3.1 8B | $0.011/1M tokens |
| 画像生成 | SD-XL | $0.023/image |

### 無料枠

- Workers AI: 毎日10,000 Neurons（LLM約10,000トークン or 画像約5枚相当）

### 月間試算（アクティブユーザー1000人想定）

```
名詞抽出: 1000人 × 100投稿/日 × 30日 × 200token = 600M tokens = $6.6
合成: 1000人 × 5回/日 × 30日 × 100token = 15M tokens = $0.17
画像生成: 500新単語/月 × $0.023 = $11.5

合計: 約 $18/月
```

---

## 実装フェーズ

### Phase 1: 基盤（Week 1）

- [ ] D1スキーマ作成
- [ ] Workers AIバインディング追加
- [ ] 名詞抽出API
- [ ] 単語ゲットAPI

### Phase 2: 画像生成（Week 2）

- [ ] 画像生成API
- [ ] nostr.buildアップロード
- [ ] デフォルト画像（生成失敗時用）

### Phase 3: フロントエンド基礎（Week 3）

- [ ] 投稿内ハイライト
- [ ] ゲット演出
- [ ] インベントリワードタブ

### Phase 4: 合成機能（Week 4）

- [ ] 合成API
- [ ] 合成UI
- [ ] 合成履歴表示

### Phase 5: 改善（Week 5+）

- [ ] レアリティシステム
- [ ] 図鑑機能
- [ ] 合成レシピ共有（Nostrイベント）

---

## 将来の拡張

### Nostrイベントとしての合成レシピ共有

```json
{
  "kind": 30078,
  "tags": [
    ["d", "synthesis:ファイアマリオ-マリオ+ルイージ"],
    ["word_a", "ファイアマリオ"],
    ["word_b", "マリオ"],
    ["word_c", "ルイージ"],
    ["result", "ファイアルイージ"]
  ],
  "content": "この組み合わせを発見しました！"
}
```

### バーコードとの連携

- 合成結果の単語にもバーコードを生成
- 単語のハッシュ → ATK/DEF/SPD
- 強い単語を合成で作る遊び

### Supernova連携

- 「10種類の単語を収集」
- 「初めての合成成功」
- 「レア単語を発見」
