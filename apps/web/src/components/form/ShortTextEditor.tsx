import { useRef, useState } from 'react'
import { LIMITS } from '../../lib/constants'
import { SuperMentionSuggest } from '../SuperMentionSuggest'

interface ShortTextEditorProps {
  content: string
  onContentChange: (content: string) => void
  placeholder?: string
}

export function ShortTextEditor({
  content,
  onContentChange,
  placeholder = 'マイペースで書こう',
}: ShortTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [cursorPosition, setCursorPosition] = useState(0)
  const [showSuggest, setShowSuggest] = useState(false)

  return (
    <div className="post-input-wrapper" style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        className="post-input"
        placeholder={placeholder}
        value={content}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement
          onContentChange(target.value)
          setCursorPosition(target.selectionStart)
          setShowSuggest(true)
        }}
        onSelect={(e) => {
          const target = e.target as HTMLTextAreaElement
          setCursorPosition(target.selectionStart)
        }}
        onBlur={() => {
          setTimeout(() => setShowSuggest(false), 150)
        }}
        onFocus={() => setShowSuggest(true)}
        rows={3}
        maxLength={LIMITS.MAX_POST_LENGTH}
      />
      {showSuggest && (
        <SuperMentionSuggest
          content={content}
          cursorPosition={cursorPosition}
          onSelect={(text, start, end) => {
            const newContent = content.slice(0, start) + text + content.slice(end)
            onContentChange(newContent)
            setTimeout(() => {
              if (textareaRef.current) {
                const newPos = start + text.length
                textareaRef.current.setSelectionRange(newPos, newPos)
                textareaRef.current.focus()
                setCursorPosition(newPos)
              }
            }, 0)
          }}
          onClose={() => setShowSuggest(false)}
        />
      )}
      {content && (
        <button
          type="button"
          className="clear-content-button"
          onClick={() => onContentChange('')}
          aria-label="Clear content"
        >
          ×
        </button>
      )}
    </div>
  )
}

// Export textarea ref access hook for image insertion
export function useTextareaRef() {
  return useRef<HTMLTextAreaElement>(null)
}
