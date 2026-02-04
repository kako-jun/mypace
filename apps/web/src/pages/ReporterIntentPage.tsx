import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { createReporterQuote } from '../lib/api'

export function ReporterIntentPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const url = searchParams.get('url')

    if (!url) {
      setError('URLが指定されていません')
      return
    }

    // Validate URL
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setError('無効なURLです')
        return
      }
    } catch {
      setError('無効なURLです')
      return
    }

    // Create quote via API
    createReporterQuote(url)
      .then((result) => {
        if (result.success && result.quote) {
          navigate(`/post/${result.quote.event.id}`, { replace: true })
        } else {
          setError(result.error || '引用投稿の作成に失敗しました')
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'エラーが発生しました')
      })
  }, [searchParams, navigate])

  if (error) {
    return (
      <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>エラー</h1>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button
          onClick={() => navigate('/')}
          style={{
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            background: 'var(--accent-color)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
          }}
        >
          ホームに戻る
        </button>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>引用投稿を作成中...</p>
    </div>
  )
}
