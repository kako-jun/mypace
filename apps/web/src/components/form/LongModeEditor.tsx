import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import type { EditorView, ViewUpdate } from '@codemirror/view'
import Button from '../ui/Button'
import '../../styles/components/long-mode-editor.css'

interface LongModeEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  vimMode?: boolean
  darkTheme?: boolean
  onWrite?: () => void
  onQuit?: () => void
  onSuperMentionTrigger?: () => void
}

export interface LongModeEditorRef {
  insertText: (text: string) => void
  focus: () => void
}

export const LongModeEditor = forwardRef<LongModeEditorRef, LongModeEditorProps>(function LongModeEditor(
  {
    value,
    onChange,
    placeholder = 'マイペースで書こう',
    vimMode = false,
    darkTheme = false,
    onWrite,
    onQuit,
    onSuperMentionTrigger,
  },
  ref
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef<(value: string) => void>(onChange)
  const onWriteRef = useRef<(() => void) | undefined>(onWrite)
  const onQuitRef = useRef<(() => void) | undefined>(onQuit)
  const onSuperMentionTriggerRef = useRef<(() => void) | undefined>(onSuperMentionTrigger)
  const [isVimActive, setIsVimActive] = useState(vimMode)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  onChangeRef.current = onChange
  onWriteRef.current = onWrite
  onQuitRef.current = onQuit
  onSuperMentionTriggerRef.current = onSuperMentionTrigger

  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      const view = viewRef.current
      if (view) {
        // Vimノーマルモード等でカーソル位置が曖昧な場合は末尾に追加
        const docLength = view.state.doc.length
        const selection = view.state.selection.main
        const pos = selection.empty ? selection.head : docLength
        view.dispatch({
          changes: { from: pos, to: pos, insert: text },
          selection: { anchor: pos + text.length },
        })
        view.focus()
      }
    },
    focus: () => viewRef.current?.focus(),
  }))

  useEffect(() => {
    if (!editorRef.current) return

    let destroyed = false
    setError(null)
    setLoading(true)

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
        { syntaxHighlighting, HighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput },
        { tags },
        { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap },
        { searchKeymap, highlightSelectionMatches },
      ] = await Promise.all([
        import('@codemirror/view'),
        import('@codemirror/state'),
        import('@codemirror/lang-markdown'),
        import('@codemirror/language-data'),
        import('@codemirror/commands'),
        import('@codemirror/language'),
        import('@lezer/highlight'),
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
            padding: '1rem 0',
            minHeight: '200px',
            caretColor: darkTheme ? '#fff' : '#333',
          },
          '.cm-line': {
            padding: '0 1rem',
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

      // Custom syntax highlighting for markdown - readable colors for both themes
      const markdownHighlightStyle = HighlightStyle.define([
        // Headers - bright and prominent
        { tag: tags.heading1, color: darkTheme ? '#79c0ff' : '#0550ae', fontWeight: 'bold', fontSize: '1.4em' },
        { tag: tags.heading2, color: darkTheme ? '#79c0ff' : '#0550ae', fontWeight: 'bold', fontSize: '1.2em' },
        { tag: tags.heading3, color: darkTheme ? '#79c0ff' : '#0550ae', fontWeight: 'bold', fontSize: '1.1em' },
        { tag: tags.heading, color: darkTheme ? '#79c0ff' : '#0550ae', fontWeight: 'bold' },
        // Links - bright and visible
        { tag: tags.link, color: darkTheme ? '#58a6ff' : '#0969da', textDecoration: 'underline' },
        { tag: tags.url, color: darkTheme ? '#58a6ff' : '#0969da', textDecoration: 'underline' },
        // Emphasis
        { tag: tags.emphasis, fontStyle: 'italic', color: darkTheme ? '#e6edf3' : '#24292e' },
        { tag: tags.strong, fontWeight: 'bold', color: darkTheme ? '#e6edf3' : '#24292e' },
        // Code
        {
          tag: tags.monospace,
          color: darkTheme ? '#ff7b72' : '#cf222e',
          backgroundColor: darkTheme ? 'rgba(110,118,129,0.3)' : 'rgba(175,184,193,0.2)',
        },
        // Quote
        { tag: tags.quote, color: darkTheme ? '#8b949e' : '#57606a', fontStyle: 'italic' },
        // Lists
        { tag: tags.list, color: darkTheme ? '#79c0ff' : '#0550ae' },
        // Meta/formatting chars
        { tag: tags.meta, color: darkTheme ? '#6e7681' : '#8c959f' },
        { tag: tags.processingInstruction, color: darkTheme ? '#6e7681' : '#8c959f' },
        // Content
        { tag: tags.content, color: darkTheme ? '#e6edf3' : '#24292e' },
        // Comment (code blocks)
        { tag: tags.comment, color: darkTheme ? '#8b949e' : '#6e7781' },
        // Strikethrough
        { tag: tags.strikethrough, textDecoration: 'line-through', color: darkTheme ? '#8b949e' : '#6e7781' },
      ])

      // Android + Gboard環境では、highlightActiveLine() がデコレーション更新時にDOMを変更し、
      // ネイティブの範囲選択が段落境界で強制解除されるバグがある
      const isAndroid = /android/i.test(navigator.userAgent)

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
        ...(isAndroid ? [] : [highlightActiveLine()]),
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
        syntaxHighlighting(markdownHighlightStyle),
        theme,
        cmPlaceholder(placeholder),
        EditorView.lineWrapping,
        // Android + Gboard環境では、空行タップ時にCodeMirrorのscrollIntoViewと
        // ブラウザネイティブのキャレットスクロールが過剰なスクロールジャンプを引き起こす
        ...(isAndroid
          ? [
              EditorView.scrollHandler.of((_view, range) => {
                const coords = _view.coordsAtPos(range.head)
                if (!coords) return false
                const scroller = _view.scrollDOM.getBoundingClientRect()
                const margin = 80
                // カーソルが既に画面内にある場合はCodeMirrorのスクロールを抑制
                return coords.top >= scroller.top + margin && coords.bottom <= scroller.bottom - margin
              }),
              // ブラウザネイティブのキャレットスクロールも補正（タップ時のみ）
              (() => {
                let touchStartY = 0
                return EditorView.domEventHandlers({
                  touchstart: (event) => {
                    touchStartY = event.touches[0].clientY
                    return false
                  },
                  touchend: (event, view) => {
                    const dy = Math.abs(event.changedTouches[0].clientY - touchStartY)
                    // 10px以上動いていたらスクロール操作なので補正しない
                    if (dy > 10) return false
                    const scrollTop = view.scrollDOM.scrollTop
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        const delta = Math.abs(view.scrollDOM.scrollTop - scrollTop)
                        if (delta > 100) {
                          view.scrollDOM.scrollTop = scrollTop
                        }
                      })
                    })
                    return false
                  },
                })
              })(),
            ]
          : []),
        EditorView.updateListener.of((update: ViewUpdate) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString()

            // Detect @@ input
            if (onSuperMentionTriggerRef.current) {
              const cursorPos = update.state.selection.main.head
              const beforeCursor = newDoc.slice(0, cursorPos)
              if (beforeCursor.endsWith('@@')) {
                // Remove the @@ that was just typed
                const newPos = cursorPos - 2
                update.view.dispatch({
                  changes: { from: newPos, to: cursorPos, insert: '' },
                  selection: { anchor: newPos, head: newPos },
                })
                const withoutTrigger = newDoc.slice(0, newPos) + newDoc.slice(cursorPos)
                onChangeRef.current?.(withoutTrigger)
                onSuperMentionTriggerRef.current()
                return
              }
            }

            onChangeRef.current?.(newDoc)
          }
        }),
      ]

      if (vimMode) {
        try {
          const { vim, Vim } = await import('@replit/codemirror-vim')
          if (!destroyed) {
            // Define custom Ex commands
            Vim.defineEx('write', 'w', () => {
              onWriteRef.current?.()
            })
            Vim.defineEx('quit', 'q', () => {
              onQuitRef.current?.()
            })
            Vim.defineEx('wq', 'wq', () => {
              onWriteRef.current?.()
              onQuitRef.current?.()
            })

            extensions.unshift(vim({ status: true }))

            // Intercept all register writes to sync with system clipboard
            // @ts-expect-error Vim internal API
            const vimGlobal = Vim.getVimGlobalState?.()
            if (vimGlobal?.registerController?.registers) {
              const registers = vimGlobal.registerController.registers
              // Wrap the unnamed register (default for yank/delete)
              const origUnnamed = registers['']
              if (origUnnamed) {
                const origSetText = origUnnamed.setText?.bind(origUnnamed)
                if (origSetText) {
                  origUnnamed.setText = (text: string) => {
                    origSetText(text)
                    navigator.clipboard.writeText(text).catch(() => {})
                  }
                }
              }
            }
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

    initEditor().catch((err) => {
      console.error('Failed to initialize editor:', err)
      setError('Failed to load editor')
      setLoading(false)
    })

    return () => {
      destroyed = true
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [vimMode, darkTheme, placeholder, retryCount])

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
      {error && !loading && (
        <div className="editor-error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={() => setRetryCount((c) => c + 1)}>
            Retry
          </Button>
        </div>
      )}
      <div ref={editorRef} className="long-mode-editor" style={{ display: loading || error ? 'none' : 'block' }} />
      {isVimActive && !loading && !error && <div className="vim-mode-indicator">VIM</div>}
    </div>
  )
})
