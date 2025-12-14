import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { PostForm } from '../components/PostForm'
import { Timeline } from '../components/Timeline'
import { LightBox, triggerLightBox } from '../components/LightBox'
import { setImageClickHandler, clearImageClickHandler } from '../lib/content-parser'
import {
  getString,
  setString,
  removeItem,
  getUIThemeColors,
  applyThemeColors,
  DEFAULT_SEARCH_FILTERS,
  loadFiltersFromStorage,
  buildSearchUrl,
} from '../lib/utils'
import { STORAGE_KEYS, CUSTOM_EVENTS, TIMEOUTS } from '../lib/constants'
import type { Event, SearchFilters } from '../types'

interface HomePageProps {
  filters?: SearchFilters
  showSearchBox?: boolean
}

export function HomePage({ filters, showSearchBox }: HomePageProps) {
  const navigate = useNavigate()

  // Redirect from home to /search with stored filters
  useEffect(() => {
    if (!showSearchBox && filters === undefined) {
      const storedFilters = loadFiltersFromStorage()
      const url = buildSearchUrl(storedFilters)
      navigate(url, { replace: true })
    }
  }, [showSearchBox, filters, navigate])

  // Use provided filters or defaults
  const activeFilters = filters ?? DEFAULT_SEARCH_FILTERS
  const [longMode, setLongMode] = useState(false)
  const [content, setContent] = useState(() => getString(STORAGE_KEYS.DRAFT))
  const [showPreview, setShowPreview] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [replyingTo, setReplyingTo] = useState<Event | null>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-save draft to localStorage with debounce
  useEffect(() => {
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current)
    }
    draftTimerRef.current = setTimeout(() => {
      if (content.trim()) {
        setString(STORAGE_KEYS.DRAFT, content)
      } else {
        removeItem(STORAGE_KEYS.DRAFT)
      }
    }, TIMEOUTS.DRAFT_SAVE_DELAY)

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current)
      }
    }
  }, [content])

  // Clear draft when a new post is successfully published
  useEffect(() => {
    const handleNewPost = () => removeItem(STORAGE_KEYS.DRAFT)
    window.addEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
    return () => window.removeEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
  }, [])

  // Apply theme colors on initial load
  useEffect(() => {
    applyThemeColors(getUIThemeColors())
  }, [])

  // Set up image click handler for LightBox
  useEffect(() => {
    setImageClickHandler(triggerLightBox)
    return () => clearImageClickHandler()
  }, [])

  // Exit long mode when logo is clicked
  useEffect(() => {
    const handleLogoClick = () => {
      if (longMode) {
        setLongMode(false)
        setShowPreview(false)
        document.body.classList.remove('long-mode-active')
      }
    }
    window.addEventListener(CUSTOM_EVENTS.LOGO_CLICKED, handleLogoClick)
    return () => window.removeEventListener(CUSTOM_EVENTS.LOGO_CLICKED, handleLogoClick)
  }, [longMode])

  const handleLongModeChange = (mode: boolean) => {
    setLongMode(mode)
    if (mode) {
      document.body.classList.add('long-mode-active')
    } else {
      document.body.classList.remove('long-mode-active')
      setShowPreview(false)
    }
  }

  const handleEditStart = (event: Event) => {
    setEditingEvent(event)
    setReplyingTo(null)
    setContent(event.content)
  }

  const handleEditCancel = () => {
    setEditingEvent(null)
    setContent('')
  }

  const handleEditComplete = () => {
    setEditingEvent(null)
    setContent('')
  }

  const handleReplyStart = (event: Event) => {
    setReplyingTo(event)
    setEditingEvent(null)
    setContent('')
  }

  const handleReplyCancel = () => {
    setReplyingTo(null)
    setContent('')
  }

  const handleReplyComplete = () => {
    setReplyingTo(null)
    setContent('')
  }

  if (longMode) {
    return (
      <PostForm
        longMode={longMode}
        onLongModeChange={handleLongModeChange}
        content={content}
        onContentChange={setContent}
        showPreview={showPreview}
        onShowPreviewChange={setShowPreview}
        editingEvent={editingEvent}
        onEditCancel={handleEditCancel}
        onEditComplete={handleEditComplete}
        replyingTo={replyingTo}
        onReplyCancel={handleReplyCancel}
        onReplyComplete={handleReplyComplete}
      />
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
        editingEvent={editingEvent}
        onEditCancel={handleEditCancel}
        onEditComplete={handleEditComplete}
        replyingTo={replyingTo}
        onReplyCancel={handleReplyCancel}
        onReplyComplete={handleReplyComplete}
      />
      <div className="container">
        <Timeline
          onEditStart={handleEditStart}
          onReplyStart={handleReplyStart}
          filters={activeFilters}
          showSearchBox={showSearchBox}
        />
      </div>
      <LightBox />
    </>
  )
}
