import { useEffect, useRef, useState } from 'hono/jsx'
import { EditorView, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { vim } from '@replit/codemirror-vim'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'

interface LongModeEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  vimMode?: boolean
  darkTheme?: boolean
}

// Custom theme for a comfortable writing experience
const createTheme = (isDark: boolean) => EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '1rem',
    fontFamily: "'M PLUS Rounded 1c', sans-serif",
  },
  '.cm-content': {
    padding: '1rem',
    minHeight: '200px',
    caretColor: isDark ? '#fff' : '#333',
  },
  '.cm-focused': {
    outline: 'none',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: "'M PLUS Rounded 1c', sans-serif",
    lineHeight: '1.8',
  },
  '.cm-line': {
    padding: '0 0.5rem',
  },
  '.cm-cursor': {
    borderLeftColor: isDark ? '#fff' : '#333',
    borderLeftWidth: '2px',
  },
  '.cm-placeholder': {
    color: isDark ? '#666' : '#aaa',
    fontStyle: 'italic',
  },
  // Markdown styling
  '.cm-header-1': {
    fontSize: '1.5em',
    fontWeight: 'bold',
  },
  '.cm-header-2': {
    fontSize: '1.3em',
    fontWeight: 'bold',
  },
  '.cm-header-3': {
    fontSize: '1.1em',
    fontWeight: 'bold',
  },
  '.cm-strong': {
    fontWeight: 'bold',
  },
  '.cm-emphasis': {
    fontStyle: 'italic',
  },
  '.cm-link': {
    color: isDark ? '#6bafff' : '#3498db',
    textDecoration: 'underline',
  },
  '.cm-url': {
    color: isDark ? '#888' : '#888',
  },
}, { dark: isDark })

// Soft color themes for comfortable writing
const lightThemeColors = EditorView.theme({
  '&': {
    backgroundColor: '#faf8f5', // Warm off-white
    color: '#333',
  },
  '.cm-gutters': {
    display: 'none',
  },
})

const darkThemeColors = EditorView.theme({
  '&': {
    backgroundColor: '#1e1e1e', // Soft dark
    color: '#d4d4d4',
  },
  '.cm-gutters': {
    display: 'none',
  },
})

export default function LongModeEditor({
  value,
  onChange,
  placeholder = '',
  vimMode = false,
  darkTheme = false,
}: LongModeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const [isVimActive, setIsVimActive] = useState(vimMode)

  useEffect(() => {
    if (!editorRef.current) return

    const extensions = [
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      markdown({ codeLanguages: languages }),
      createTheme(darkTheme),
      darkTheme ? darkThemeColors : lightThemeColors,
      cmPlaceholder(placeholder),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChange(update.state.doc.toString())
        }
      }),
    ]

    // Add vim mode if enabled
    if (vimMode) {
      extensions.unshift(vim())
    }

    const state = EditorState.create({
      doc: value,
      extensions,
    })

    const view = new EditorView({
      state,
      parent: editorRef.current,
    })

    viewRef.current = view
    setIsVimActive(vimMode)

    return () => {
      view.destroy()
    }
  }, [vimMode, darkTheme]) // Recreate editor when vim mode or theme changes

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      })
    }
  }, [value])

  return (
    <div class="long-mode-editor-wrapper">
      <div ref={editorRef} class="long-mode-editor" />
      {isVimActive && (
        <div class="vim-mode-indicator">VIM</div>
      )}
    </div>
  )
}
