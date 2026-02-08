import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, ErrorMessage } from '../ui'
import { createReporterQuote } from '../../lib/api'

interface NPCContentProps {
  initialUrl?: string
}

type NPCView = 'select' | 'reporter'

export function NPCContent({ initialUrl = '' }: NPCContentProps) {
  const navigate = useNavigate()
  const [view, setView] = useState<NPCView>(initialUrl ? 'reporter' : 'select')
  const [url, setUrl] = useState(initialUrl)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleReporterSelect = () => {
    setView('reporter')
    setError('')
  }

  const handleBack = () => {
    setView('select')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }

    // Basic URL validation
    try {
      const parsedUrl = new URL(url)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        setError('URL must start with http:// or https://')
        return
      }
    } catch {
      setError('Please enter a valid URL')
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('[NPC Reporter] Sending request for URL:', url)
      const result = await createReporterQuote(url)
      console.log('[NPC Reporter] API response:', result)

      if (result.success && result.quote) {
        // Navigate to the created quote post
        console.log('[NPC Reporter] Navigating to:', `/post/${result.quote.event.id}`)
        navigate(`/post/${result.quote.event.id}`)
      } else {
        setError(result.error || 'Failed to create quote post')
      }
    } catch (e) {
      console.error('[NPC Reporter] Error:', e)
      setError(e instanceof Error ? e.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="npc-content">
      {view === 'select' ? (
        <div className="npc-list">
          <button className="npc-item" onClick={handleReporterSelect}>
            <Icon name="Newspaper" size={16} />
            <span>Reporter</span>
            <Icon name="ChevronRight" size={16} />
          </button>
          <button className="npc-item" disabled>
            <Icon name="RefreshCw" size={16} />
            <span>Spreader</span>
          </button>
        </div>
      ) : (
        <div className="npc-reporter-view">
          <button className="npc-back-button" onClick={handleBack}>
            <Icon name="ArrowLeft" size={16} />
            <span>Back</span>
          </button>

          <div className="npc-reporter-header">
            <Icon name="Newspaper" size={16} />
            <span className="npc-reporter-title">Ask Reporter</span>
          </div>

          <form onSubmit={handleSubmit} className="npc-reporter-form">
            <label className="npc-form-label">Enter URL to quote:</label>
            <input
              type="url"
              className="npc-form-input"
              placeholder="https://"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <ErrorMessage>{error}</ErrorMessage>
            <button type="submit" className="npc-form-submit btn btn-primary" disabled={loading || !url.trim()}>
              {loading ? 'Creating...' : 'Create Quote'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
