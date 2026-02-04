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
  image_status: string
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

【出力形式】
JSON配列のみを出力してください。説明は不要です。
対象となる単語がない場合は [] を返してください。

テキスト:
`

const SYNTHESIS_PROMPT = `あなたは単語のベクトル演算を行う専門家です。

単語の意味的な関係性を考慮して、以下の演算の結果を導出してください。

【演算】
「{wordA}」 － 「{wordB}」 ＋ 「{wordC}」 ＝ ？

【参考例】
- 「ファイアマリオ」－「マリオ」＋「ルイージ」＝「ファイアルイージ」
- 「王様」－「男」＋「女」＝「女王」
- 「東京」－「日本」＋「フランス」＝「パリ」
- 「子犬」－「犬」＋「猫」＝「子猫」
- 「朝食」－「朝」＋「夜」＝「夕食」

【ルール】
1. 結果は1つの名詞または複合語のみ
2. 意味的な関係性を考慮して導出
3. 存在しない造語も可（ファイアルイージなど）
4. 結果が導出できない場合のみ「???」を返す
5. 余計な説明は不要、結果の単語のみを出力

【出力】
結果の単語のみを出力してください（「」は不要）:
`

const IMAGE_PROMPT_TEMPLATE = `A cute chibi pixel art character representing "{word}",
square format 256x256,
simple solid color background,
2-head-tall proportions (large head, small body),
16-bit retro game style,
vibrant colors,
centered composition,
no text or labels`

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

// Helper: Extract nouns using Workers AI
async function extractNouns(ai: Bindings['AI'], content: string): Promise<string[]> {
  try {
    // Clean content before extraction
    const cleanedContent = cleanContentForExtraction(content)

    // Skip if nothing left after cleaning
    if (!cleanedContent || cleanedContent.length < 2) {
      return []
    }

    // Use any to avoid strict type checking on model names
    const response = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'user',
          content: EXTRACT_NOUNS_PROMPT + `"${cleanedContent}"`,
        },
      ],
      max_tokens: 500,
    })

    const text = response?.response || ''
    if (!text || typeof text !== 'string') return []

    // Parse JSON array from response
    const match = text.match(/\[[\s\S]*?\]/)
    if (!match) return []

    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed)) return []

    // Filter and clean
    return parsed.filter((w): w is string => typeof w === 'string' && w.length > 0 && w.length <= 20).slice(0, 10) // Max 10 words per post
  } catch (e) {
    console.error('Noun extraction error:', e)
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
    const response = await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 50,
    })

    const text = response?.response || ''
    if (!text || typeof text !== 'string') return null

    // Clean result
    const result = text
      .trim()
      .replace(/^「|」$/g, '')
      .trim()
    if (!result || result === '???' || result.length > 30) return null

    return result
  } catch (e) {
    console.error('Synthesis error:', e)
    return null
  }
}

// Helper: Generate image using Workers AI Stable Diffusion
async function generateImage(ai: Bindings['AI'], word: string): Promise<ArrayBuffer | null> {
  try {
    console.log(`[generateImage] Starting image generation for word: ${word}`)
    const prompt = IMAGE_PROMPT_TEMPLATE.replace('{word}', word)
    console.log(`[generateImage] Using prompt: ${prompt.substring(0, 50)}...`)

    // Use any to avoid strict type checking on model names
    const response = await (ai as any).run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
      prompt,
      num_steps: 20,
    })

    console.log(
      `[generateImage] Response type: ${typeof response}, instanceof ArrayBuffer: ${response instanceof ArrayBuffer}, instanceof Uint8Array: ${response instanceof Uint8Array}`
    )

    if (response instanceof ArrayBuffer || response instanceof Uint8Array) {
      const buffer = response instanceof ArrayBuffer ? response : (response.buffer as ArrayBuffer)
      console.log(`[generateImage] Generated image buffer size: ${buffer.byteLength} bytes`)
      return buffer
    }

    console.error(`[generateImage] Invalid response type for word: ${word}`)
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
    return c.json({ words: JSON.parse(cached.words_json), cached: true })
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
    cachedMap.set(row.event_id, JSON.parse(row.words_json))
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

    // Queue image generation (async, don't wait)
    const nsec = c.env.UPLOADER_NSEC
    if (nsec) {
      generateWordImage(ai, db, nsec, wordRecord.id, word).catch(console.error)
    } else {
      console.error('[collect] UPLOADER_NSEC not configured')
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

  return c.json({
    word: wordRecord,
    isNew,
    isFirstEver,
    count: 1, // Always return 1 since it's binary
  })
})

// Helper: Generate and upload image for a word
async function generateWordImage(
  ai: Bindings['AI'],
  db: Bindings['DB'],
  nsec: string,
  wordId: number,
  wordText: string
): Promise<void> {
  try {
    // Mark as generating
    await db.prepare(`UPDATE wordrot_words SET image_status = 'generating' WHERE id = ?`).bind(wordId).run()

    // Generate image
    const imageData = await generateImage(ai, wordText)

    if (!imageData) {
      await db.prepare(`UPDATE wordrot_words SET image_status = 'failed' WHERE id = ?`).bind(wordId).run()
      return
    }

    // Upload to nostr.build
    const imageUrl = await uploadToNostrBuild(imageData, nsec)

    if (!imageUrl) {
      await db.prepare(`UPDATE wordrot_words SET image_status = 'failed' WHERE id = ?`).bind(wordId).run()
      return
    }

    // Update word with image URL
    await db
      .prepare(`UPDATE wordrot_words SET image_url = ?, image_status = 'done' WHERE id = ?`)
      .bind(imageUrl, wordId)
      .run()
  } catch (e) {
    console.error(`[generateWordImage] Error for word "${wordText}" (ID: ${wordId}):`, e)
    await db.prepare(`UPDATE wordrot_words SET image_status = 'failed' WHERE id = ?`).bind(wordId).run()
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
    // Use cached result
    await db
      .prepare(
        `UPDATE wordrot_syntheses SET use_count = use_count + 1 WHERE word_a_id = ? AND word_b_id = ? AND word_c_id = ?`
      )
      .bind(wordARecord.id, wordBRecord.id, wordCRecord.id)
      .run()

    resultWord = await db
      .prepare(`SELECT * FROM wordrot_words WHERE id = ?`)
      .bind(existingSynthesis.result_word_id)
      .first<WordrotWord>()
  } else {
    // Perform synthesis with AI
    const resultText = await synthesizeWords(ai, wordA, wordB, wordC)

    if (!resultText) {
      return c.json({ error: 'Synthesis failed - no valid result', result: '???' }, 200)
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
        // Queue image generation
        const nsec = c.env.UPLOADER_NSEC
        if (nsec) {
          generateWordImage(ai, db, nsec, resultWord.id, resultText).catch(console.error)
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
         w.id, w.text, w.image_url, w.image_status, w.discovered_by, w.discovered_at,
         w.discovery_count, w.synthesis_count,
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
      image_status: row.image_status,
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

  const db = c.env.DB
  const ai = c.env.AI

  const word = await db.prepare(`SELECT * FROM wordrot_words WHERE id = ?`).bind(wordId).first<WordrotWord>()

  if (!word) {
    return c.json({ error: 'Word not found' }, 404)
  }

  if (word.image_status === 'done') {
    return c.json({ error: 'Image already generated', image_url: word.image_url }, 400)
  }

  // Queue regeneration
  const nsec = c.env.UPLOADER_NSEC
  if (nsec) {
    generateWordImage(ai, db, nsec, word.id, word.text).catch(console.error)
  }

  return c.json({ success: true, message: 'Image generation queued' })
})

export default wordrot
