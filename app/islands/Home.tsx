import { useState } from 'hono/jsx'
import PostForm from './PostForm'
import Timeline from './Timeline'
import { renderContent } from '../lib/content-parser'

export default function Home() {
  const [longMode, setLongMode] = useState(false)
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  return (
    <>
      <PostForm
        longMode={longMode}
        onLongModeChange={setLongMode}
        content={content}
        onContentChange={setContent}
        showPreview={showPreview}
        onShowPreviewChange={setShowPreview}
      />
      {longMode ? (
        showPreview && content.trim() && (
          <div class="long-mode-preview">
            {renderContent(content)}
          </div>
        )
      ) : (
        <Timeline />
      )}
    </>
  )
}
