import { useEffect, useRef, useState } from 'react'
import type { EditorView, ViewUpdate } from '@codemirror/view'

interface LongModeEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  vimMode?: boolean
  darkTheme?: boolean
}

export function LongModeEditor({
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
        {
          EditorView,
          keymap,
          placeholder: cmPlaceholder,
          lineNumbers,
          highlightActiveLine,
          highlightActiveLineGutter,
          highlightSpecialChars,
          drawSelection,
          dropCursor,
          rectangularSelection,
          crosshairCursor,
        },
        { EditorState },
        { markdown },
        { languages },
        { defaultKeymap, history, historyKeymap, indentWithTab },
        { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput },
        { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap },
        { searchKeymap, highlightSelectionMatches },
      ] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/lang-markdown'),
        import('@codemirror/language-data'),
        import('@codemirror/commands'),
        import('@codemirror/language'),
        import('@codemirror/autocomplete'),
        import('@codemirror/search'),
      ])

      if (destroyed || !editorRef.current) return

      const monoFont = "'BIZ UDGothic', 'SF Mono', 'Menlo', 'Consolas', ui-monospace, monospace"
      const theme = EditorView.theme(
        {
          '&': {
            height: '100%',
            fontSize: '1rem',
            fontFamily: monoFont,
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
            fontFamily: monoFont,
            lineHeight: '1.8',
          },
          '.cm-gutters': {
            backgroundColor: darkTheme ? '#1e1e1e' : '#faf8f5',
            color: darkTheme ? '#666' : '#999',
            border: 'none',
          },
          '.cm-activeLineGutter': {
            backgroundColor: darkTheme ? '#2a2a2a' : '#f0ede8',
          },
          '.cm-activeLine': {
            backgroundColor: darkTheme ? '#2a2a2a' : '#f0ede8',
          },
          '.cm-selectionMatch': {
            backgroundColor: darkTheme ? '#3a3a3a' : '#e0ddd5',
          },
          '.cm-matchingBracket': {
            backgroundColor: darkTheme ? '#3a3a3a' : '#e0ddd5',
            outline: '1px solid ' + (darkTheme ? '#666' : '#999'),
          },
          '.cm-foldGutter': {
            width: '1em',
          },
          '.cm-placeholder': {
            color: darkTheme ? '#666' : '#aaa',
            fontStyle: 'italic',
          },
        },
        { dark: darkTheme }
      )

      const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        dropCursor(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        markdown({ codeLanguages: languages }),
        syntaxHighlighting(defaultHighlightStyle),
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
        } catch {
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
    <div className="long-mode-editor-wrapper">
      {loading && <div className="editor-loading">Loading editor...</div>}
      <div ref={editorRef} className="long-mode-editor" style={{ display: loading ? 'none' : 'block' }} />
      {isVimActive && !loading && <div className="vim-mode-indicator">VIM</div>}
    </div>
  )
}
