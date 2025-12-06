import { useState } from 'hono/jsx'
import PostForm from './PostForm'
import Timeline from './Timeline'
import { renderContent } from '../lib/content-parser'

export default function Home() {
  const [longMode, setLongMode] = useState(false)
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const handleLongModeChange = (mode: boolean) => {
    setLongMode(mode)
    if (mode) {
      document.body.classList.add('long-mode-active')
    } else {
      document.body.classList.remove('long-mode-active')
      setShowPreview(false)
    }
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
      />
      <Timeline />
    </>
  )
}
