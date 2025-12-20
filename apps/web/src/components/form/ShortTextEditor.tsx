import { useRef, useImperativeHandle, forwardRef } from 'react'
import { LIMITS } from '../../lib/constants'

interface ShortTextEditorProps {
  content: string
  onContentChange: (content: string) => void
  placeholder?: string
  onSuperMentionTrigger?: () => void
}

export interface ShortTextEditorRef {
  insertText: (text: string) => void
  focus: () => void
}

export const ShortTextEditor = forwardRef<ShortTextEditorRef, ShortTextEditorProps>(function ShortTextEditor(
  { content, onContentChange, placeholder = 'マイペースで書こう', onSuperMentionTrigger },
  ref
) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const prevContentRef = useRef(content)

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (textareaRef.current) {
        const pos = textareaRef.current.selectionStart
        const newContent = content.slice(0, pos) + text + content.slice(pos)
        onContentChange(newContent)
        const newPos = pos + text.length
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.setSelectionRange(newPos, newPos)
            textareaRef.current.focus()
          }
        }, 0)
      }
    },
    focus: () => textareaRef.current?.focus(),
  }))

  return (
    <div className="post-input-wrapper" style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        className="post-input"
        placeholder={placeholder}
        value={content}
        onInput={(e) => {
          const target = e.target as HTMLTextAreaElement
          const newValue = target.value
          const prevValue = prevContentRef.current

          // Detect @/ input: check if @/ was just typed
          if (onSuperMentionTrigger && newValue.length > prevValue.length) {
            const cursorPos = target.selectionStart
            const beforeCursor = newValue.slice(0, cursorPos)
            if (beforeCursor.endsWith('@/')) {
              // Remove the @/ that was just typed
              const withoutTrigger = newValue.slice(0, cursorPos - 2) + newValue.slice(cursorPos)
              onContentChange(withoutTrigger)
              prevContentRef.current = withoutTrigger
              onSuperMentionTrigger()
              return
            }
          }

          prevContentRef.current = newValue
          onContentChange(newValue)
        }}
        rows={3}
        maxLength={LIMITS.MAX_POST_LENGTH}
      />
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
})

// Export textarea ref access hook for image insertion
export function useTextareaRef() {
  return useRef<HTMLTextAreaElement>(null)
}
