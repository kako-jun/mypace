import { useEffect, useRef, useState } from 'hono/jsx'
import type { EditorView, ViewUpdate } from '@codemirror/view'

interface LongModeEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  vimMode?: boolean
  darkTheme?: boolean
}

export default function LongModeEditor({
  value,
  onChange,
  placeholder = '',
  vimMode = false,
  darkTheme = false,
}: LongModeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef<(value: string) => void>(onChange)
  const [isVimActive, setIsVimActive] = useState(vimMode)
  const [loading, setLoading] = useState(true)

  onChangeRef.current = onChange

  useEffect(() => {
    if (!editorRef.current) return

    let destroyed = false

    const initEditor = async () => {
      const [
        { EditorView, keymap, placeholder: cmPlaceholder },
        { EditorState },
        { markdown },
        { languages },
        { defaultKeymap, history, historyKeymap },
      ] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/lang-markdown'),
        import('@codemirror/language-data'),
        import('@codemirror/commands'),
      ])

      if (destroyed || !editorRef.current) return

      const theme = EditorView.theme({
        '&': {
          height: '100%',
          fontSize: '1rem',
          fontFamily: "'M PLUS Rounded 1c', sans-serif",
          backgroundColor: darkTheme ? '#1e1e1e' : '#faf8f5',
          color: darkTheme ? '#d4d4d4' : '#333',
        },
        '.cm-content': {
          padding: '1rem',
          minHeight: '200px',
          caretColor: darkTheme ? '#fff' : '#333',
        },
        '.cm-focused': { outline: 'none' },
        '.cm-scroller': {
          overflow: 'auto',
          fontFamily: "'M PLUS Rounded 1c', sans-serif",
          lineHeight: '1.8',
        },
        '.cm-gutters': { display: 'none' },
        '.cm-placeholder': {
          color: darkTheme ? '#666' : '#aaa',
          fontStyle: 'italic',
        },
      }, { dark: darkTheme })

      const extensions = [
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        markdown({ codeLanguages: languages }),
        theme,
        cmPlaceholder(placeholder),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        }),
      ]

      if (vimMode) {
        try {
          const { vim } = await import('@replit/codemirror-vim')
          if (!destroyed) {
            extensions.unshift(vim())
          }
        } catch (e) {
          console.warn('Vim mode not available')
        }
      }

      if (destroyed || !editorRef.current) return

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
      setLoading(false)
    }

    initEditor()

    return () => {
      destroyed = true
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [vimMode, darkTheme, placeholder])

  // Clear editor when value becomes empty (after posting)
  useEffect(() => {
    const view = viewRef.current
    if (view && value === '' && view.state.doc.toString() !== '') {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
      })
    }
  }, [value])

  return (
    <div class="long-mode-editor-wrapper">
      {loading && <div class="editor-loading">Loading editor...</div>}
      <div ref={editorRef} class="long-mode-editor" style={{ display: loading ? 'none' : 'block' }} />
      {isVimActive && !loading && <div class="vim-mode-indicator">VIM</div>}
    </div>
  )
}
