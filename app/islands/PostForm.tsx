import { useState, useEffect } from 'hono/jsx'
import { createTextNote, getLocalThemeColors, getThemeCardProps, type ThemeColors } from '../lib/nostr/events'
import { publishEvent } from '../lib/nostr/relay'
import { renderContent } from '../lib/content-parser'
import ProfileSetup, { hasLocalProfile } from './ProfileSetup'

interface PostFormProps {
  longMode: boolean
  onLongModeChange: (mode: boolean) => void
  content: string
  onContentChange: (content: string) => void
  showPreview: boolean
  onShowPreviewChange: (show: boolean) => void
}

export default function PostForm({ longMode, onLongModeChange, content, onContentChange, showPreview, onShowPreviewChange }: PostFormProps) {
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const [hasProfile, setHasProfile] = useState(false)
  const [checkingProfile, setCheckingProfile] = useState(true)
  const [themeColors, setThemeColors] = useState<ThemeColors | null>(null)

  useEffect(() => {
    setHasProfile(hasLocalProfile())
    setCheckingProfile(false)
    setThemeColors(getLocalThemeColors())

    const handleProfileUpdate = () => setHasProfile(hasLocalProfile())
    window.addEventListener('profileupdated', handleProfileUpdate)
    return () => window.removeEventListener('profileupdated', handleProfileUpdate)
  }, [])

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    if (!content.trim() || posting || !hasProfile) return

    setPosting(true)
    setError('')

    try {
      const event = await createTextNote(content.trim())
      await publishEvent(event)
      onContentChange('')
      window.dispatchEvent(new CustomEvent('newpost'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setPosting(false)
    }
  }

  const handleProfileSet = () => {
    setHasProfile(true)
    window.dispatchEvent(new CustomEvent('profileupdated'))
  }

  if (checkingProfile) {
    return <div class="post-form loading">Loading...</div>
  }

  if (!hasProfile) {
    return (
      <div class="post-form">
        <ProfileSetup onProfileSet={handleProfileSet} />
      </div>
    )
  }

  return (
    <form class={`post-form ${longMode ? 'long-mode' : ''}`} onSubmit={handleSubmit}>
      <button
        type="button"
        class={`mode-toggle-corner ${longMode ? 'active' : ''}`}
        onClick={() => onLongModeChange(!longMode)}
      >
        {longMode ? 'Short mode' : 'Long mode'}
      </button>
      <textarea
        class="post-input"
        placeholder={longMode ? "マイペースに書こう\n\n長文モードでじっくり書けます" : "マイペースに書こう"}
        value={content}
        onInput={(e) => onContentChange((e.target as HTMLTextAreaElement).value)}
        rows={longMode ? 15 : 3}
        maxLength={4200}
      />
      {!longMode && showPreview && content.trim() && (() => {
        const themeProps = getThemeCardProps(themeColors)
        return (
          <div class={`post-preview ${themeProps.className}`} style={themeProps.style}>
            <div class="preview-label">Preview</div>
            <div class="preview-content">
              {renderContent(content)}
            </div>
          </div>
        )
      })()}
      <div class="post-actions">
        <div class="post-actions-left">
          <button
            type="button"
            class={`preview-toggle ${showPreview ? 'active' : ''}`}
            onClick={() => onShowPreviewChange(!showPreview)}
          >
            {showPreview ? 'Hide' : 'Preview'}
          </button>
          <span class="char-count">{content.length}/4200</span>
        </div>
        <button type="submit" class="post-button" disabled={posting || !content.trim()}>
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>
      {error && <p class="error">{error}</p>}
    </form>
  )
}
