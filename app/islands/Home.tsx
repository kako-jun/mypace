import { useState } from 'hono/jsx'
import PostForm from './PostForm'
import Timeline from './Timeline'
import { renderContent } from '../lib/content-parser'
import type { Event } from 'nostr-tools'

interface HomeProps {
  initialFilterTags?: string[]
  initialFilterMode?: 'and' | 'or'
}

export default function Home({ initialFilterTags, initialFilterMode }: HomeProps) {
  const [longMode, setLongMode] = useState(false)
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [replyingTo, setReplyingTo] = useState<Event | null>(null)

  const handleLongModeChange = (mode: boolean) => {
    setLongMode(mode)
    if (mode) {
      document.body.classList.add('long-mode-active')
    } else {
      document.body.classList.remove('long-mode-active')
      setShowPreview(false)
    }
  }

  const handleEditStart = (event: Event) => {
    setEditingEvent(event)
    setReplyingTo(null)
    setContent(event.content)
  }

  const handleEditCancel = () => {
    setEditingEvent(null)
    setContent('')
  }

  const handleEditComplete = () => {
    setEditingEvent(null)
    setContent('')
  }

  const handleReplyStart = (event: Event) => {
    setReplyingTo(event)
    setEditingEvent(null)
    setContent('')
  }

  const handleReplyCancel = () => {
    setReplyingTo(null)
    setContent('')
  }

  const handleReplyComplete = () => {
    setReplyingTo(null)
    setContent('')
  }

  if (longMode) {
    return (
      <div class={`long-mode-container ${showPreview ? '' : 'no-preview'}`}>
        <div class="long-mode-editor">
          <PostForm
            longMode={longMode}
            onLongModeChange={handleLongModeChange}
            content={content}
            onContentChange={setContent}
            showPreview={showPreview}
            onShowPreviewChange={setShowPreview}
            editingEvent={editingEvent}
            onEditCancel={handleEditCancel}
            onEditComplete={handleEditComplete}
            replyingTo={replyingTo}
            onReplyCancel={handleReplyCancel}
            onReplyComplete={handleReplyComplete}
          />
        </div>
        {showPreview && (
          <div class="long-mode-preview">
            {content.trim() ? renderContent(content) : (
              <p class="preview-placeholder">プレビューがここに表示されます</p>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <PostForm
        longMode={longMode}
        onLongModeChange={handleLongModeChange}
        content={content}
        onContentChange={setContent}
        showPreview={showPreview}
        onShowPreviewChange={setShowPreview}
        editingEvent={editingEvent}
        onEditCancel={handleEditCancel}
        onEditComplete={handleEditComplete}
        replyingTo={replyingTo}
        onReplyCancel={handleReplyCancel}
        onReplyComplete={handleReplyComplete}
      />
      <Timeline onEditStart={handleEditStart} onReplyStart={handleReplyStart} initialFilterTags={initialFilterTags} initialFilterMode={initialFilterMode} />
    </>
  )
}
