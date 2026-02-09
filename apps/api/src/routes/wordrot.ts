import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getCurrentTimestamp } from '../utils'
import { finalizeEvent, nip19 } from 'nostr-tools'

const wordrot = new Hono<{ Bindings: Bindings }>()

// Types
interface WordrotWord {
  id: number
  text: string
  image_url: string | null
  image_hash: string | null
  image_status: string
  image_url_synthesis: string | null
  image_hash_synthesis: string | null
  image_status_synthesis: string
  discovered_by: string | null
  discovered_at: number
  discovery_count: number
  synthesis_count: number
}

interface UserWord {
  word: WordrotWord
  count: number
  first_collected_at: number
  last_collected_at: number
  source: string
}

// LLM prompts
const EXTRACT_NOUNS_PROMPT = `あなたはテキストから収集対象の単語を抽出する専門家です。

以下のテキストから、収集対象となる単語を抽出してください。

【対象とする単語 - 厳守】
1. カタカナ語（外来語・固有名詞）
   - 例：マリオ、ピカチュウ、ドラえもん、コーヒー、コンピューター
   
2. 英語の名詞（英単語で名詞のみ）
   - 例：apple, car, book, coffee, Mario, Pikachu
   - 動詞・形容詞・副詞は対象外

【対象としない語】
- ひらがなのみの語（りんご、ねこ、さくら）
- 漢字のみの語（東京、日本、本、車）
- 漢字とひらがなの混在語（食べ物、動物、植物）
- 代名詞（これ、それ、私、彼）
- 一般的すぎる語（もの、こと、人、時）
- 助数詞（個、人、回、本）
- 記号やURL、ハッシュタグ
- 動詞・形容詞・副詞（run, beautiful, quickly）
- 助動詞

【重要：複合語は最小単位に分割】
カタカナの複合語は意味のある最小単位に分割：
- 「マリオカート」→ ["マリオ", "カート"]
- 「ファイアマリオ」→ ["ファイア", "マリオ"]
- 「スーパーマリオ」→ ["スーパー", "マリオ"]
- 「ドリフトキング」→ ["ドリフト", "キング"]

【セルフチェック - 出力前に必ず確認】
抽出した各単語について、出力前に以下を自問してください：
- この単語は名詞か？（冠詞・前置詞・接続詞・代名詞・動詞・形容詞・副詞ではないか？）
- 英語の場合: the, in, on, at, to, of, is, it, be, are, was, for, with, from, this, that, your, my, his, her などの機能語ではないか？
名詞でないものは除外してください。

【出力形式】
JSON配列のみを出力してください。説明は不要です。
対象となる単語がない場合は [] を返してください。

テキスト:
`

const SYNTHESIS_PROMPT = `あなたは単語のベクトル演算を行う専門家です。

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
`

const IMAGE_PROMPT_TEMPLATE = `Extreme close-up 16-bit pixel art of {description}, filling the entire frame.
Flat solid dark navy (#1a1a2e) background, nothing else behind the subject.
One single subject, very large, zoomed in, touching all four edges of the image.
Retro SNES game sprite style, bold outlines, vibrant saturated colors that contrast against the dark background.
No text, no letters, no words, no border, no frame, no grid, no pattern, no multiple copies.`

const SYNTHESIS_IMAGE_PROMPT_TEMPLATE = `Extreme close-up 16-bit pixel art of {description}, filling the entire frame.
Flat solid dark purple (#2d1a3e) background, nothing else behind the subject.
One single subject, very large, zoomed in, touching all four edges of the image.
The subject should look like a cute, round, small living creature — with big friendly eyes, soft body, like a Kirby or Slime. Not humanoid, not scary. Adorable and squishy.
Retro SNES game sprite style, bold outlines, vibrant saturated colors that contrast against the dark background.
No text, no letters, no words, no border, no frame, no grid, no pattern, no multiple copies.`

const DESCRIBE_WORD_PROMPT = `Given a word, output a concise English visual description (3-8 words) for a pixel art image prompt.

Rules:
- Output ONLY the description phrase, no explanation, no quotes
- Describe the concrete visual form of the word
- Always include a specific bright color (to contrast with dark background)
- Animals → the animal: "a blue and white dolphin", "a red ladybug beetle"
- Foods → the food: "a bright red bell pepper", "a green matcha latte cup"
- Objects → the object: "a silver metallic robot", "a blue desktop computer"
- Characters → iconic look: "a green one-eyed giant mecha robot", "a round pink puffball creature"
- Abstract → symbol: "a glowing blue code terminal screen", "a purple electric lightning bolt"
- Brands → mascot/logo: "a black and white tuxedo penguin", "a purple chat bubble bot"
- AVOID very dark colors (dark navy, dark purple, black) in the subject — they would blend with the dark background

Word: `

const SYNTHESIS_DESCRIBE_WORD_PROMPT = `Given a word, output a concise English visual description (3-8 words) for a pixel art creature prompt.

IMPORTANT: The subject must be a cute, round, small living creature — like a Kirby, Slime, or Tamagotchi pet.
Do NOT draw the object itself. Instead, imagine an adorable little creature INSPIRED BY or THEMED AFTER the word.
Never scary, never humanoid. Always round, squishy, friendly, with big eyes.

Rules:
- Output ONLY the description phrase, no explanation, no quotes
- Always include a specific bright color (to contrast with dark background)
- Foods → cute creature themed after it: "a round red apple buddy with big eyes", "a bubbly blue soda blob pet"
- Objects → adorable creature inspired by it: "a silver round robot-shaped pet", "a blue glowing screen-face blob"
- Animals → cute round version: "a puffy blue baby dolphin", "a tiny round red ladybug pet"
- Characters → cute creature version: "a round red caped tiny hero blob", "a pink squishy puffball"
- Abstract → adorable living form: "a glowing blue jellyfish pet", "a tiny purple spark blob"
- AVOID very dark colors (dark navy, dark purple, black) in the subject — they would blend with the dark background

Word: `

const ITALIAN_CONVERSION_PROMPT = `You are an expert translator for creating Italian phrases from word formulas.

Given three words (A, B, C) in a synthesis formula "A - B + C", convert them to Italian following these rules:

1. A (first word): Convert to POSSESSIVE or ADJECTIVAL form
   - Use possessive (di + noun) if it sounds more natural (e.g., "King" → "Di Re")
   - Use relational adjective if more natural (e.g., "King" → "Regale")
   - Choose whichever sounds better in Italian

2. B (second word): Convert to ADJECTIVAL form (different from A's form)
   - Use relational adjective (e.g., "Man" → "Umano", "Male" → "Maschile")
   - Should be a different grammatical form than A

3. C (third word): Convert to NOUN form
   - Keep as singular noun (e.g., "Woman" → "Donna", "Queen" → "Regina")

Special cases:
- Proper nouns (Mario, Pikachu): Keep as-is OR translate if commonly known
- Katakana loanwords (コーヒー): Translate to Italian equivalent (Caffè)
- English words: Translate to Italian
- Abstract concepts: Use poetic/metaphorical Italian

Output format: Return ONLY three words separated by spaces: "A_italian B_italian C_italian"
No explanation, no quotes, no punctuation except hyphens if needed for compound words.

Example:
Input: King, Man, Woman
Output: Regale Umano Donna

Input: Emperor, Male, Female
Output: Imperiale Maschile Femmina

Now translate: `

// Helper: Validate that a word is strictly katakana-only or English-alphabet-only
// This is a hard filter applied AFTER LLM extraction to guarantee correctness
const ENGLISH_STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'in',
  'on',
  'at',
  'to',
  'of',
  'is',
  'it',
  'be',
  'am',
  'are',
  'was',
  'were',
  'do',
  'does',
  'did',
  'has',
  'have',
  'had',
  'he',
  'she',
  'we',
  'me',
  'my',
  'or',
  'and',
  'but',
  'if',
  'so',
  'no',
  'not',
  'nor',
  'for',
  'by',
  'as',
  'up',
  'out',
  'off',
  'all',
  'its',
  'his',
  'her',
  'our',
  'your',
  'their',
  'this',
  'that',
  'with',
  'from',
  'into',
  'about',
  'than',
  'then',
  'them',
  'they',
  'been',
  'being',
  'which',
  'what',
  'when',
  'where',
  'who',
  'whom',
  'how',
  'why',
  'will',
  'would',
  'could',
  'should',
  'shall',
  'may',
  'might',
  'must',
  'can',
  'just',
  'also',
  'very',
  'here',
  'there',
  'each',
  'every',
  'both',
  'some',
  'any',
  'such',
  'only',
  'own',
  'same',
  'other',
  'more',
  'most',
  'too',
  'now',
  'over',
  'under',
  'after',
  'before',
  'between',
  'through',
])

function isValidWordrotWord(word: string): boolean {
  // Must be at least 2 characters
  if (word.length < 2) return false

  // Pattern 1: Pure katakana (ァ-ヶ, prolonged sound mark ー, iteration marks ヽヾ)
  const isKatakana = /^[\u30A1-\u30F6\u30FC\u30FD\u30FE]+$/.test(word)
  if (isKatakana) return true

  // Pattern 2: Pure English letters (at least 2 chars, only alphabetic, not a stop word)
  const isEnglish = /^[a-zA-Z]{2,}$/.test(word)
  if (isEnglish) return !ENGLISH_STOP_WORDS.has(word.toLowerCase())

  return false
}

// Helper: Clean content before noun extraction
// Removes URLs, code blocks, hashtags, mentions - elements that shouldn't be word sources
function cleanContentForExtraction(content: string): string {
  let cleaned = content

  // Remove code blocks (```...```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '')

  // Remove inline code (`...`)
  cleaned = cleaned.replace(/`[^`]+`/g, '')

  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, '')

  // Remove nostr: mentions (npub, note, nevent, nprofile, naddr)
  cleaned = cleaned.replace(/nostr:[a-z0-9]+/gi, '')

  // Remove hashtags
  cleaned = cleaned.replace(/#[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g, '')

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim()

  return cleaned
}

// Helper: Regex-based extraction as a safety net against LLM misses
// Catches all katakana sequences and English words deterministically
function extractByRegex(cleanedContent: string): string[] {
  const words: string[] = []

  // Extract katakana sequences (2+ chars)
  const katakanaMatches = cleanedContent.match(/[\u30A1-\u30F6\u30FC\u30FD\u30FE]{2,}/g)
  if (katakanaMatches) {
    words.push(...katakanaMatches)
  }

  // Extract English words (2+ chars, standalone alphabetic tokens)
  const englishMatches = cleanedContent.match(/\b[a-zA-Z]{2,}\b/g)
  if (englishMatches) {
    words.push(...englishMatches)
  }

  return words.filter((w) => w.length <= 20)
}

// Helper: Extract nouns using Workers AI + regex safety net
async function extractNouns(ai: Bindings['AI'], content: string): Promise<string[]> {
  // Clean content before extraction
  const cleanedContent = cleanContentForExtraction(content)

  // Skip if nothing left after cleaning
  if (!cleanedContent || cleanedContent.length < 2) {
    return []
  }

  // Run regex extraction (deterministic, never misses) and LLM extraction (handles compound splitting) in parallel
  const [regexWords, llmWords] = await Promise.all([
    Promise.resolve(extractByRegex(cleanedContent)),
    extractNounsLLM(ai, cleanedContent),
  ])

  // Merge: union of both, deduplicated, validated
  const seen = new Set<string>()
  const merged: string[] = []

  // LLM results first (they include compound splits like マリオカート → マリオ, カート)
  for (const w of llmWords) {
    const key = w.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(w)
    }
  }

  // Then regex results to fill in anything LLM missed
  // Skip regex words that are already covered by LLM compound splits
  for (const w of regexWords) {
    const key = w.toLowerCase()
    if (!seen.has(key)) {
      // Check if this regex word is a compound that LLM already split
      // e.g. regex found "マリオカート" but LLM already returned "マリオ" and "カート"
      const alreadySplit = merged.some((m) => w.length > m.length && w.includes(m))
      if (!alreadySplit) {
        seen.add(key)
        merged.push(w)
      }
    }
  }

  return merged.filter(isValidWordrotWord).slice(0, 10)
}

// Helper: Strip <think>...</think> tags from LLM responses (Qwen3 reasoning output)
function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}

// Helper: Extract text content from Workers AI response (handles both old and OpenAI-compatible formats)
function extractLLMText(response: any): string {
  // Old format: { response: "..." }
  if (response?.response && typeof response.response === 'string') {
    return response.response
  }
  // OpenAI-compatible format: { choices: [{ message: { content: "..." } }] }
  const message = response?.choices?.[0]?.message
  if (message?.content && typeof message.content === 'string') {
    return message.content
  }
  // Qwen3 reasoning-only output: content is null but reasoning_content has text
  if (message?.reasoning_content && typeof message.reasoning_content === 'string') {
    return message.reasoning_content
  }
  return ''
}

// Helper: LLM-based noun extraction (handles compound splitting and noun filtering)
async function extractNounsLLM(ai: Bindings['AI'], cleanedContent: string): Promise<string[]> {
  try {
    const response = await (ai as any).run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [
        {
          role: 'user',
          content: EXTRACT_NOUNS_PROMPT + `"${cleanedContent}"\n/no_think`,
        },
      ],
      max_tokens: 500,
    })

    const rawText = extractLLMText(response)
    if (!rawText) return []
    const text = stripThinkTags(rawText)

    // Parse JSON array from response
    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) return []

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []

    return parsed.filter((w): w is string => typeof w === 'string' && w.length > 0 && w.length <= 20)
  } catch (e) {
    console.error('LLM noun extraction error:', e)
    return []
  }
}

// Helper: Synthesize words using Workers AI
async function synthesizeWords(
  ai: Bindings['AI'],
  wordA: string,
  wordB: string,
  wordC: string
): Promise<string | null> {
  try {
    const prompt = SYNTHESIS_PROMPT.replace('{wordA}', wordA).replace('{wordB}', wordB).replace('{wordC}', wordC)

    // Use any to avoid strict type checking on model names
    const response = await (ai as any).run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [
        {
          role: 'user',
          content: prompt + '\n/no_think',
        },
      ],
      max_tokens: 100,
    })

    const rawText = extractLLMText(response)
    if (!rawText) return null

    // Clean result
    const result = stripThinkTags(rawText)
      .replace(/^(?:結果|答え|出力|回答)\s*[：:]\s*/i, '')
      .replace(/[「」『』""''""]/g, '')
      .replace(/[。．.！!？?]+$/g, '')
      .trim()
    if (!result || result === '???' || result.length > 30) return null

    return result
  } catch (e) {
    console.error('Synthesis error:', e)
    return null
  }
}

// Helper: Translate word to English visual description for image generation
async function describeWordForImage(ai: Bindings['AI'], word: string, isSynthesis = false): Promise<string> {
  try {
    const describePrompt = isSynthesis ? SYNTHESIS_DESCRIBE_WORD_PROMPT : DESCRIBE_WORD_PROMPT
    const response = await (ai as any).run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [{ role: 'user', content: describePrompt + `"${word}"\n/no_think` }],
      max_tokens: 100,
    })
    const rawText = extractLLMText(response)
    if (!rawText) return word
    const description = stripThinkTags(rawText)
      .replace(/^["']|["']$/g, '')
      .trim()
    if (!description || description.length > 80) return word
    console.log(`[describeWordForImage] "${word}" → "${description}"`)
    return description
  } catch (e) {
    console.error(`[describeWordForImage] Error for "${word}":`, e)
    return word
  }
}

// Helper: Convert synthesis formula to Italian TTS phrase
async function convertToItalian(
  ai: Bindings['AI'],
  wordA: string,
  wordB: string,
  wordC: string
): Promise<{ a: string; b: string; c: string } | null> {
  try {
    const prompt = ITALIAN_CONVERSION_PROMPT + `${wordA}, ${wordB}, ${wordC}`
    const response = await (ai as any).run('@cf/qwen/qwen3-30b-a3b-fp8', {
      messages: [{ role: 'user', content: prompt + '\n/no_think' }],
      max_tokens: 50,
    })

    const rawText = extractLLMText(response)
    if (!rawText) return null

    const cleaned = stripThinkTags(rawText)
      .replace(/^["']|["']$/g, '')
      .trim()

    // Parse "Word1 Word2 Word3" format
    const parts = cleaned.split(/\s+/)
    if (parts.length !== 3) {
      console.error(`[convertToItalian] Invalid format: ${cleaned}`)
      return null
    }

    console.log(`[convertToItalian] ${wordA}, ${wordB}, ${wordC} → ${parts[0]}, ${parts[1]}, ${parts[2]}`)
    return { a: parts[0], b: parts[1], c: parts[2] }
  } catch (e) {
    console.error(`[convertToItalian] Error:`, e)
    return null
  }
}

// Helper: Generate image using Workers AI FLUX.1
async function generateImage(ai: Bindings['AI'], word: string, isSynthesis = false): Promise<ArrayBuffer | null> {
  try {
    console.log(`[generateImage] Starting image generation for word: ${word} (synthesis: ${isSynthesis})`)
    const description = await describeWordForImage(ai, word, isSynthesis)
    const template = isSynthesis ? SYNTHESIS_IMAGE_PROMPT_TEMPLATE : IMAGE_PROMPT_TEMPLATE
    const prompt = template.replace('{description}', description)
    console.log(`[generateImage] Using prompt: ${prompt.substring(0, 100)}...`)

    const response = await (ai as any).run('@cf/black-forest-labs/flux-1-schnell', {
      prompt,
      steps: 8,
    })

    // FLUX.1 returns { image: "<base64>" }
    if (response && typeof response === 'object' && typeof response.image === 'string') {
      const base64 = response.image
      const binaryStr = atob(base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      console.log(`[generateImage] Decoded base64 image: ${bytes.byteLength} bytes`)
      return bytes.buffer as ArrayBuffer
    }

    // Fallback: handle raw binary responses (ArrayBuffer, Uint8Array, ReadableStream)
    if (response instanceof ArrayBuffer) {
      console.log(`[generateImage] ArrayBuffer response: ${response.byteLength} bytes`)
      return response
    }
    if (response instanceof Uint8Array) {
      console.log(`[generateImage] Uint8Array response: ${response.byteLength} bytes`)
      return response.buffer as ArrayBuffer
    }
    if (response instanceof ReadableStream) {
      console.log(`[generateImage] ReadableStream response, reading...`)
      const reader = response.getReader()
      const chunks: Uint8Array[] = []
      let totalLength = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        totalLength += value.byteLength
      }
      const buffer = new ArrayBuffer(totalLength)
      const view = new Uint8Array(buffer)
      let offset = 0
      for (const chunk of chunks) {
        view.set(chunk, offset)
        offset += chunk.byteLength
      }
      return buffer
    }

    console.error(`[generateImage] Unexpected response type for word: ${word}`, typeof response, response)
    return null
  } catch (e) {
    console.error(`[generateImage] Error generating image for word "${word}":`, e)
    return null
  }
}

// Helper: Upload to nostr.build using NIP-98 authentication
async function uploadToNostrBuild(imageData: ArrayBuffer, nsec: string): Promise<string | null> {
  try {
    console.log(`[uploadToNostrBuild] Uploading image, size: ${imageData.byteLength} bytes`)

    // Decode nsec to get secret key
    const { data: secretKey } = nip19.decode(nsec)

    // Create NIP-98 auth event
    const authEvent = {
      kind: 27235,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['u', 'https://nostr.build/api/v2/upload/files'],
        ['method', 'POST'],
      ],
      content: '',
      pubkey: '', // Will be filled by finalizeEvent
    }

    // Sign the event
    const signedEvent = finalizeEvent(authEvent, secretKey as Uint8Array)

    // Base64 encode the event
    const authBase64 = btoa(JSON.stringify(signedEvent))

    const blob = new Blob([imageData], { type: 'image/png' })
    const formData = new FormData()
    formData.append('file', blob, 'word.png')

    const response = await fetch('https://nostr.build/api/v2/upload/files', {
      method: 'POST',
      headers: {
        Authorization: `Nostr ${authBase64}`,
      },
      body: formData,
    })

    console.log(`[uploadToNostrBuild] Response status: ${response.status}`)

    if (!response.ok) {
      console.error('[uploadToNostrBuild] Upload failed:', response.status)
      return null
    }

    const result = (await response.json()) as {
      status: string
      data?: Array<{ url: string }>
    }
    console.log(`[uploadToNostrBuild] Upload result:`, result)

    if (result.status === 'success' && result.data?.[0]?.url) {
      return result.data[0].url
    }

    return null
  } catch (e) {
    console.error('nostr.build upload error:', e)
    return null
  }
}

// POST /api/wordrot/extract - Extract nouns from post content
wordrot.post('/extract', async (c) => {
  const body = await c.req.json<{ eventId: string; content: string }>()
  const { eventId, content } = body

  if (!eventId || !content) {
    return c.json({ error: 'eventId and content are required' }, 400)
  }

  const db = c.env.DB
  const now = getCurrentTimestamp()

  // Check cache first
  const cached = await db
    .prepare(`SELECT words_json FROM wordrot_event_words WHERE event_id = ?`)
    .bind(eventId)
    .first<{ words_json: string }>()

  if (cached) {
    const words = (JSON.parse(cached.words_json) as string[]).filter(isValidWordrotWord)
    return c.json({ words, cached: true })
  }

  // Extract nouns using AI
  const words = await extractNouns(c.env.AI, content)

  // Cache result
  await db
    .prepare(
      `INSERT OR REPLACE INTO wordrot_event_words (event_id, words_json, analyzed_at)
       VALUES (?, ?, ?)`
    )
    .bind(eventId, JSON.stringify(words), now)
    .run()

  return c.json({ words, cached: false })
})

// POST /api/wordrot/extract-batch - Extract nouns from multiple posts
wordrot.post('/extract-batch', async (c) => {
  const body = await c.req.json<{ posts: Array<{ eventId: string; content: string }> }>()
  const { posts } = body

  if (!posts || !Array.isArray(posts) || posts.length === 0) {
    return c.json({ error: 'posts array is required' }, 400)
  }

  // Limit batch size
  if (posts.length > 50) {
    return c.json({ error: 'Maximum 50 posts per batch' }, 400)
  }

  const db = c.env.DB
  const now = getCurrentTimestamp()

  // Check cache for all events
  const eventIds = posts.map((p) => p.eventId)
  const placeholders = eventIds.map(() => '?').join(',')
  const cachedResults = await db
    .prepare(`SELECT event_id, words_json FROM wordrot_event_words WHERE event_id IN (${placeholders})`)
    .bind(...eventIds)
    .all<{ event_id: string; words_json: string }>()

  const cachedMap = new Map<string, string[]>()
  for (const row of cachedResults.results || []) {
    cachedMap.set(row.event_id, (JSON.parse(row.words_json) as string[]).filter(isValidWordrotWord))
  }

  // Find posts that need extraction
  const uncachedPosts = posts.filter((p) => !cachedMap.has(p.eventId))

  // Extract words for uncached posts
  const extractedMap = new Map<string, string[]>()

  if (uncachedPosts.length > 0) {
    // Process in parallel with concurrency limit
    const CONCURRENCY = 3
    for (let i = 0; i < uncachedPosts.length; i += CONCURRENCY) {
      const batch = uncachedPosts.slice(i, i + CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (post) => {
          const words = await extractNouns(c.env.AI, post.content)
          return { eventId: post.eventId, words }
        })
      )

      for (const { eventId, words } of results) {
        extractedMap.set(eventId, words)
      }
    }

    // Cache all extracted results
    for (const [eventId, words] of extractedMap) {
      await db
        .prepare(
          `INSERT OR REPLACE INTO wordrot_event_words (event_id, words_json, analyzed_at)
           VALUES (?, ?, ?)`
        )
        .bind(eventId, JSON.stringify(words), now)
        .run()
    }
  }

  // Build response
  const results: Record<string, { words: string[]; cached: boolean }> = {}
  for (const post of posts) {
    if (cachedMap.has(post.eventId)) {
      results[post.eventId] = { words: cachedMap.get(post.eventId)!, cached: true }
    } else if (extractedMap.has(post.eventId)) {
      results[post.eventId] = { words: extractedMap.get(post.eventId)!, cached: false }
    } else {
      results[post.eventId] = { words: [], cached: false }
    }
  }

  return c.json({
    results,
    stats: {
      total: posts.length,
      cached: cachedMap.size,
      extracted: extractedMap.size,
    },
  })
})

// POST /api/wordrot/collect - Collect a word
wordrot.post('/collect', async (c) => {
  const body = await c.req.json<{ pubkey: string; word: string; eventId?: string }>()
  const { pubkey, word } = body

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  if (!word || word.length > 30) {
    return c.json({ error: 'Invalid word' }, 400)
  }

  const db = c.env.DB
  const ai = c.env.AI
  const now = getCurrentTimestamp()

  // Get or create word
  let wordRecord = await db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(word).first<WordrotWord>()

  let isFirstEver = false

  if (!wordRecord) {
    // First ever discovery of this word
    isFirstEver = true

    await db
      .prepare(
        `INSERT INTO wordrot_words (text, image_status, discovered_by, discovered_at, created_at)
         VALUES (?, 'pending', ?, ?, ?)`
      )
      .bind(word, pubkey, now, now)
      .run()

    wordRecord = await db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(word).first<WordrotWord>()

    if (!wordRecord) {
      return c.json({ error: 'Failed to create word' }, 500)
    }

    // Queue image generation (async, keep worker alive with waitUntil)
    const nsec = c.env.UPLOADER_NSEC
    if (nsec) {
      c.executionCtx.waitUntil(generateWordImage(ai, db, nsec, wordRecord.id, word))
    } else {
      console.error('[collect] UPLOADER_NSEC not configured, marking image as failed')
      await db.prepare(`UPDATE wordrot_words SET image_status = 'failed' WHERE id = ?`).bind(wordRecord.id).run()
    }
  } else {
    // Increment discovery count
    await db
      .prepare(`UPDATE wordrot_words SET discovery_count = discovery_count + 1 WHERE id = ?`)
      .bind(wordRecord.id)
      .run()
  }

  // Add to user's collection
  const existingUserWord = await db
    .prepare(`SELECT count FROM wordrot_user_words WHERE pubkey = ? AND word_id = ?`)
    .bind(pubkey, wordRecord.id)
    .first<{ count: number }>()

  const isNew = !existingUserWord

  if (!existingUserWord) {
    // First time collecting this word - add to inventory
    await db
      .prepare(
        `INSERT INTO wordrot_user_words (pubkey, word_id, count, first_collected_at, last_collected_at, source)
         VALUES (?, ?, 1, ?, ?, 'harvest')`
      )
      .bind(pubkey, wordRecord.id, now, now)
      .run()
  }
  // If already exists, do nothing - Wordrot is binary (have/not have)

  // Refresh word record to get latest data
  wordRecord = await db.prepare(`SELECT * FROM wordrot_words WHERE id = ?`).bind(wordRecord.id).first<WordrotWord>()

  // collectレスポンスに更新後インベントリを含める（クライアントの再取得を不要にする）
  const inventoryResult = await db
    .prepare(
      `SELECT
         w.id, w.text, w.image_url, w.image_hash, w.image_status, 
         w.image_url_synthesis, w.image_hash_synthesis, w.image_status_synthesis,
         w.discovered_by, w.discovered_at, w.discovery_count, w.synthesis_count,
         uw.count, uw.first_collected_at, uw.last_collected_at, uw.source
       FROM wordrot_user_words uw
       JOIN wordrot_words w ON uw.word_id = w.id
       WHERE uw.pubkey = ?
       ORDER BY uw.last_collected_at DESC`
    )
    .bind(pubkey)
    .all<WordrotWord & { count: number; first_collected_at: number; last_collected_at: number; source: string }>()

  const inventoryWords: UserWord[] = (inventoryResult.results || []).map((row) => ({
    word: {
      id: row.id,
      text: row.text,
      image_url: row.image_url,
      image_hash: row.image_hash,
      image_status: row.image_status,
      image_url_synthesis: row.image_url_synthesis,
      image_hash_synthesis: row.image_hash_synthesis,
      image_status_synthesis: row.image_status_synthesis,
      discovered_by: row.discovered_by,
      discovered_at: row.discovered_at,
      discovery_count: row.discovery_count,
      synthesis_count: row.synthesis_count,
    },
    count: row.count,
    first_collected_at: row.first_collected_at,
    last_collected_at: row.last_collected_at,
    source: row.source,
  }))

  const inventoryTotalCount = inventoryWords.reduce((sum, w) => sum + w.count, 0)

  return c.json({
    word: wordRecord,
    isNew,
    isFirstEver,
    count: 1, // Always return 1 since it's binary
    inventory: {
      words: inventoryWords,
      totalCount: inventoryTotalCount,
      uniqueCount: inventoryWords.length,
    },
  })
})

// Helper: Generate and upload image for a word
async function generateWordImage(
  ai: Bindings['AI'],
  db: Bindings['DB'],
  nsec: string,
  wordId: number,
  wordText: string,
  isSynthesis = false
): Promise<void> {
  try {
    // Mark as generating
    if (isSynthesis) {
      await db.prepare(`UPDATE wordrot_words SET image_status_synthesis = 'generating' WHERE id = ?`).bind(wordId).run()
    } else {
      await db.prepare(`UPDATE wordrot_words SET image_status = 'generating' WHERE id = ?`).bind(wordId).run()
    }

    // Generate image
    const imageData = await generateImage(ai, wordText, isSynthesis)

    if (!imageData) {
      if (isSynthesis) {
        await db.prepare(`UPDATE wordrot_words SET image_status_synthesis = 'failed' WHERE id = ?`).bind(wordId).run()
      } else {
        await db.prepare(`UPDATE wordrot_words SET image_status = 'failed' WHERE id = ?`).bind(wordId).run()
      }
      return
    }

    // Upload to nostr.build
    const imageUrl = await uploadToNostrBuild(imageData, nsec)

    if (!imageUrl) {
      if (isSynthesis) {
        await db.prepare(`UPDATE wordrot_words SET image_status_synthesis = 'failed' WHERE id = ?`).bind(wordId).run()
      } else {
        await db.prepare(`UPDATE wordrot_words SET image_status = 'failed' WHERE id = ?`).bind(wordId).run()
      }
      return
    }

    // Update word with image URL
    if (isSynthesis) {
      await db
        .prepare(`UPDATE wordrot_words SET image_url_synthesis = ?, image_status_synthesis = 'done' WHERE id = ?`)
        .bind(imageUrl, wordId)
        .run()
    } else {
      await db
        .prepare(`UPDATE wordrot_words SET image_url = ?, image_status = 'done' WHERE id = ?`)
        .bind(imageUrl, wordId)
        .run()
    }
  } catch (e) {
    console.error(`[generateWordImage] Error for word "${wordText}" (ID: ${wordId}):`, e)
    if (isSynthesis) {
      await db.prepare(`UPDATE wordrot_words SET image_status_synthesis = 'failed' WHERE id = ?`).bind(wordId).run()
    } else {
      await db.prepare(`UPDATE wordrot_words SET image_status = 'failed' WHERE id = ?`).bind(wordId).run()
    }
  }
}

// POST /api/wordrot/synthesize - Synthesize words
wordrot.post('/synthesize', async (c) => {
  const body = await c.req.json<{
    pubkey: string
    wordA: string
    wordB: string
    wordC: string
  }>()

  const { pubkey, wordA, wordB, wordC } = body

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  if (!wordA || !wordB || !wordC) {
    return c.json({ error: 'All three words are required' }, 400)
  }

  const db = c.env.DB
  const ai = c.env.AI
  const now = getCurrentTimestamp()

  // Get word IDs
  const [wordARecord, wordBRecord, wordCRecord] = await Promise.all([
    db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(wordA).first<WordrotWord>(),
    db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(wordB).first<WordrotWord>(),
    db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(wordC).first<WordrotWord>(),
  ])

  if (!wordARecord || !wordBRecord || !wordCRecord) {
    return c.json({ error: 'One or more words not found in your collection' }, 400)
  }

  // Check if user owns all three words
  const [userA, userB, userC] = await Promise.all([
    db
      .prepare(`SELECT count FROM wordrot_user_words WHERE pubkey = ? AND word_id = ?`)
      .bind(pubkey, wordARecord.id)
      .first<{ count: number }>(),
    db
      .prepare(`SELECT count FROM wordrot_user_words WHERE pubkey = ? AND word_id = ?`)
      .bind(pubkey, wordBRecord.id)
      .first<{ count: number }>(),
    db
      .prepare(`SELECT count FROM wordrot_user_words WHERE pubkey = ? AND word_id = ?`)
      .bind(pubkey, wordCRecord.id)
      .first<{ count: number }>(),
  ])

  if (!userA || !userB || !userC) {
    return c.json({ error: 'You do not own all three words' }, 400)
  }

  // Check if synthesis already exists
  const existingSynthesis = await db
    .prepare(
      `SELECT s.*, w.text as result_text FROM wordrot_syntheses s
       JOIN wordrot_words w ON s.result_word_id = w.id
       WHERE word_a_id = ? AND word_b_id = ? AND word_c_id = ?`
    )
    .bind(wordARecord.id, wordBRecord.id, wordCRecord.id)
    .first<{ result_word_id: number; result_text: string; use_count: number }>()

  let resultWord: WordrotWord | null = null
  let isNewSynthesis = false
  let isNewWord = false

  if (existingSynthesis) {
    // Use cached result - update use_count and discovered_at to make it appear as the latest recipe
    await db
      .prepare(
        `UPDATE wordrot_syntheses SET use_count = use_count + 1, discovered_at = ? WHERE word_a_id = ? AND word_b_id = ? AND word_c_id = ?`
      )
      .bind(now, wordARecord.id, wordBRecord.id, wordCRecord.id)
      .run()

    resultWord = await db
      .prepare(`SELECT * FROM wordrot_words WHERE id = ?`)
      .bind(existingSynthesis.result_word_id)
      .first<WordrotWord>()
  } else {
    // Perform synthesis with AI
    const resultText = await synthesizeWords(ai, wordA, wordB, wordC)

    if (!resultText) {
      return c.json({ error: 'Synthesis failed - no valid result' }, 200)
    }

    isNewSynthesis = true

    // Get or create result word
    resultWord = await db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(resultText).first<WordrotWord>()

    if (!resultWord) {
      // Brand new word from synthesis
      isNewWord = true

      await db
        .prepare(
          `INSERT INTO wordrot_words (text, image_status, discovered_by, discovered_at, synthesis_count, created_at)
           VALUES (?, 'pending', ?, ?, 1, ?)`
        )
        .bind(resultText, pubkey, now, now)
        .run()

      resultWord = await db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(resultText).first<WordrotWord>()

      if (resultWord) {
        // Queue image generation (async, keep worker alive with waitUntil)
        const nsec = c.env.UPLOADER_NSEC
        if (nsec) {
          c.executionCtx.waitUntil(generateWordImage(ai, db, nsec, resultWord.id, resultText, true))
        } else {
          console.error('[synthesize] UPLOADER_NSEC not configured, marking image as failed')
          await db
            .prepare(`UPDATE wordrot_words SET image_status_synthesis = 'failed' WHERE id = ?`)
            .bind(resultWord.id)
            .run()
        }
      }
    } else {
      // Word exists, increment synthesis count
      await db
        .prepare(`UPDATE wordrot_words SET synthesis_count = synthesis_count + 1 WHERE id = ?`)
        .bind(resultWord.id)
        .run()
    }

    if (resultWord) {
      // Record synthesis
      await db
        .prepare(
          `INSERT INTO wordrot_syntheses (word_a_id, word_b_id, word_c_id, result_word_id, discovered_by, discovered_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .bind(wordARecord.id, wordBRecord.id, wordCRecord.id, resultWord.id, pubkey, now)
        .run()
    }
  }

  if (!resultWord) {
    return c.json({ error: 'Synthesis failed' }, 500)
  }

  // Add result to user's collection
  const existingUserWord = await db
    .prepare(`SELECT count FROM wordrot_user_words WHERE pubkey = ? AND word_id = ?`)
    .bind(pubkey, resultWord.id)
    .first<{ count: number }>()

  if (existingUserWord) {
    await db
      .prepare(
        `UPDATE wordrot_user_words SET count = count + 1, last_collected_at = ? WHERE pubkey = ? AND word_id = ?`
      )
      .bind(now, pubkey, resultWord.id)
      .run()
  } else {
    await db
      .prepare(
        `INSERT INTO wordrot_user_words (pubkey, word_id, count, first_collected_at, last_collected_at, source)
         VALUES (?, ?, 1, ?, ?, 'synthesis')`
      )
      .bind(pubkey, resultWord.id, now, now)
      .run()
  }

  return c.json({
    result: resultWord,
    isNewSynthesis,
    isNewWord,
    formula: `${wordA} - ${wordB} + ${wordC} = ${resultWord.text}`,
  })
})

// GET /api/wordrot/inventory/:pubkey - Get user's word collection
wordrot.get('/inventory/:pubkey', async (c) => {
  const pubkey = c.req.param('pubkey')

  if (!pubkey || pubkey.length !== 64) {
    return c.json({ error: 'Invalid pubkey' }, 400)
  }

  const db = c.env.DB

  const result = await db
    .prepare(
      `SELECT
         w.id, w.text, w.image_url, w.image_hash, w.image_status, 
         w.image_url_synthesis, w.image_hash_synthesis, w.image_status_synthesis,
         w.discovered_by, w.discovered_at, w.discovery_count, w.synthesis_count,
         uw.count, uw.first_collected_at, uw.last_collected_at, uw.source
       FROM wordrot_user_words uw
       JOIN wordrot_words w ON uw.word_id = w.id
       WHERE uw.pubkey = ?
       ORDER BY uw.last_collected_at DESC`
    )
    .bind(pubkey)
    .all<WordrotWord & { count: number; first_collected_at: number; last_collected_at: number; source: string }>()

  const words: UserWord[] = (result.results || []).map((row) => ({
    word: {
      id: row.id,
      text: row.text,
      image_url: row.image_url,
      image_hash: row.image_hash,
      image_status: row.image_status,
      image_url_synthesis: row.image_url_synthesis,
      image_hash_synthesis: row.image_hash_synthesis,
      image_status_synthesis: row.image_status_synthesis,
      discovered_by: row.discovered_by,
      discovered_at: row.discovered_at,
      discovery_count: row.discovery_count,
      synthesis_count: row.synthesis_count,
    },
    count: row.count,
    first_collected_at: row.first_collected_at,
    last_collected_at: row.last_collected_at,
    source: row.source,
  }))

  const totalCount = words.reduce((sum, w) => sum + w.count, 0)

  return c.json({
    words,
    totalCount,
    uniqueCount: words.length,
  })
})

// GET /api/wordrot/word/:text - Get word details
wordrot.get('/word/:text', async (c) => {
  const text = decodeURIComponent(c.req.param('text'))

  if (!text) {
    return c.json({ error: 'Word text is required' }, 400)
  }

  const db = c.env.DB

  const word = await db.prepare(`SELECT * FROM wordrot_words WHERE text = ?`).bind(text).first<WordrotWord>()

  if (!word) {
    return c.json({ error: 'Word not found' }, 404)
  }

  // Get syntheses where this word is the result
  const asResult = await db
    .prepare(
      `SELECT wa.text as word_a, wb.text as word_b, wc.text as word_c, s.use_count
       FROM wordrot_syntheses s
       JOIN wordrot_words wa ON s.word_a_id = wa.id
       JOIN wordrot_words wb ON s.word_b_id = wb.id
       JOIN wordrot_words wc ON s.word_c_id = wc.id
       WHERE s.result_word_id = ?
       ORDER BY s.use_count DESC
       LIMIT 10`
    )
    .bind(word.id)
    .all<{ word_a: string; word_b: string; word_c: string; use_count: number }>()

  // Get syntheses where this word is used as input
  const asInput = await db
    .prepare(
      `SELECT wa.text as word_a, wb.text as word_b, wc.text as word_c, wr.text as result, s.use_count
       FROM wordrot_syntheses s
       JOIN wordrot_words wa ON s.word_a_id = wa.id
       JOIN wordrot_words wb ON s.word_b_id = wb.id
       JOIN wordrot_words wc ON s.word_c_id = wc.id
       JOIN wordrot_words wr ON s.result_word_id = wr.id
       WHERE s.word_a_id = ? OR s.word_b_id = ? OR s.word_c_id = ?
       ORDER BY s.use_count DESC
       LIMIT 10`
    )
    .bind(word.id, word.id, word.id)
    .all<{ word_a: string; word_b: string; word_c: string; result: string; use_count: number }>()

  return c.json({
    word,
    synthesesAsResult: asResult.results || [],
    synthesesAsInput: asInput.results || [],
  })
})

// GET /api/wordrot/recipes/:text - Get recent synthesis recipes for a word (latest 10)
wordrot.get('/recipes/:text', async (c) => {
  const text = decodeURIComponent(c.req.param('text'))

  if (!text) {
    return c.json({ error: 'Word text is required' }, 400)
  }

  const db = c.env.DB

  const word = await db.prepare(`SELECT id FROM wordrot_words WHERE text = ?`).bind(text).first<{ id: number }>()

  if (!word) {
    return c.json({ error: 'Word not found' }, 404)
  }

  // Get recent syntheses where this word is the result (latest 10, newest first)
  const recipes = await db
    .prepare(
      `SELECT wa.text as word_a, wb.text as word_b, wc.text as word_c, s.discovered_at
       FROM wordrot_syntheses s
       JOIN wordrot_words wa ON s.word_a_id = wa.id
       JOIN wordrot_words wb ON s.word_b_id = wb.id
       JOIN wordrot_words wc ON s.word_c_id = wc.id
       WHERE s.result_word_id = ?
       ORDER BY s.discovered_at DESC
       LIMIT 10`
    )
    .bind(word.id)
    .all<{ word_a: string; word_b: string; word_c: string; discovered_at: number }>()

  return c.json({
    recipes: recipes.results || [],
  })
})

// POST /api/wordrot/italian - Convert synthesis formula to Italian
wordrot.post('/italian', async (c) => {
  const body = await c.req.json<{
    wordA: string
    wordB: string
    wordC: string
  }>()

  const { wordA, wordB, wordC } = body

  if (!wordA || !wordB || !wordC) {
    return c.json({ error: 'All three words are required' }, 400)
  }

  const ai = c.env.AI
  const result = await convertToItalian(ai, wordA, wordB, wordC)

  if (!result) {
    return c.json({ error: 'Italian conversion failed' }, 500)
  }

  return c.json(result)
})

// GET /api/wordrot/leaderboard - Get discovery leaderboard
wordrot.get('/leaderboard', async (c) => {
  const db = c.env.DB

  // Top discoverers
  const discoverers = await db
    .prepare(
      `SELECT discovered_by as pubkey, COUNT(*) as count
       FROM wordrot_words
       WHERE discovered_by IS NOT NULL
       GROUP BY discovered_by
       ORDER BY count DESC
       LIMIT 20`
    )
    .all<{ pubkey: string; count: number }>()

  // Most popular words
  const popularWords = await db
    .prepare(
      `SELECT text, image_url, discovery_count, synthesis_count
       FROM wordrot_words
       ORDER BY discovery_count DESC
       LIMIT 20`
    )
    .all<{ text: string; image_url: string | null; discovery_count: number; synthesis_count: number }>()

  // Recent discoveries
  const recentWords = await db
    .prepare(
      `SELECT text, image_url, discovered_by, discovered_at
       FROM wordrot_words
       WHERE image_status = 'done'
       ORDER BY discovered_at DESC
       LIMIT 20`
    )
    .all<{ text: string; image_url: string | null; discovered_by: string | null; discovered_at: number }>()

  return c.json({
    topDiscoverers: discoverers.results || [],
    popularWords: popularWords.results || [],
    recentWords: recentWords.results || [],
  })
})

// POST /api/wordrot/retry-image/:wordId - Retry image generation for a word
wordrot.post('/retry-image/:wordId', async (c) => {
  const wordId = parseInt(c.req.param('wordId'), 10)

  if (isNaN(wordId)) {
    return c.json({ error: 'Invalid word ID' }, 400)
  }

  // Get source from query params (default: harvest)
  const source = c.req.query('source') || 'harvest'
  const isSynthesis = source === 'synthesis'

  const db = c.env.DB
  const ai = c.env.AI

  const word = await db.prepare(`SELECT * FROM wordrot_words WHERE id = ?`).bind(wordId).first<WordrotWord>()

  if (!word) {
    return c.json({ error: 'Word not found' }, 404)
  }

  // Check appropriate image_status based on source
  const imageStatus = isSynthesis ? word.image_status_synthesis : word.image_status
  const imageUrl = isSynthesis ? word.image_url_synthesis : word.image_url

  if (imageStatus === 'done') {
    return c.json({ error: 'Image already generated', image_url: imageUrl }, 400)
  }

  // Queue regeneration
  const nsec = c.env.UPLOADER_NSEC
  if (!nsec) {
    return c.json({ error: 'UPLOADER_NSEC not configured' }, 500)
  }

  c.executionCtx.waitUntil(generateWordImage(ai, db, nsec, word.id, word.text, isSynthesis))

  return c.json({ success: true, message: 'Image generation queued' })
})

// POST /api/wordrot/retry-all-images - Retry image generation for all failed/pending words
wordrot.post('/retry-all-images', async (c) => {
  const db = c.env.DB
  const ai = c.env.AI
  const nsec = c.env.UPLOADER_NSEC

  if (!nsec) {
    return c.json({ error: 'UPLOADER_NSEC not configured' }, 500)
  }

  // Get words with failed/pending harvest images
  const harvestWords = await db
    .prepare(`SELECT id, text FROM wordrot_words WHERE image_status IN ('failed', 'pending') LIMIT 50`)
    .all<{ id: number; text: string }>()

  // Get words with failed/pending synthesis images
  const synthesisWords = await db
    .prepare(`SELECT id, text FROM wordrot_words WHERE image_status_synthesis IN ('failed', 'pending') LIMIT 50`)
    .all<{ id: number; text: string }>()

  const harvestTargets = harvestWords.results || []
  const synthesisTargets = synthesisWords.results || []

  if (harvestTargets.length === 0 && synthesisTargets.length === 0) {
    return c.json({ success: true, queued: 0, message: 'No words need image generation' })
  }

  // Queue harvest images
  for (const word of harvestTargets) {
    c.executionCtx.waitUntil(generateWordImage(ai, db, nsec, word.id, word.text, false))
  }

  // Queue synthesis images
  for (const word of synthesisTargets) {
    c.executionCtx.waitUntil(generateWordImage(ai, db, nsec, word.id, word.text, true))
  }

  const totalQueued = harvestTargets.length + synthesisTargets.length

  return c.json({
    success: true,
    queued: totalQueued,
    harvest: harvestTargets.length,
    synthesis: synthesisTargets.length,
    message: `Queued ${totalQueued} images for generation (${harvestTargets.length} harvest, ${synthesisTargets.length} synthesis)`,
  })
})

export default wordrot
