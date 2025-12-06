import { useState } from 'hono/jsx'
import { createTextNote } from '../lib/nostr/events'
import { publishEvent } from '../lib/nostr/relay'

export default function PostForm() {
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!content.trim() || posting) return

    setPosting(true)
    setError('')

    try {
      const event = await createTextNote(content.trim())
      await publishEvent(event)
      setContent('')
      window.dispatchEvent(new CustomEvent('newpost'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  return (
    <form class="post-form" onSubmit={handleSubmit}>
      <textarea
        class="post-input"
        placeholder="What's on your mind?"
        value={content}
        onInput={(e) => setContent((e.target as HTMLTextAreaElement).value)}
        rows={3}
        maxLength={280}
      />
      <div class="post-actions">
        <span class="char-count">{content.length}/280</span>
        <button type="submit" class="post-button" disabled={posting || !content.trim()}>
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>
      {error && <p class="error">{error}</p>}
    </form>
  )
}
