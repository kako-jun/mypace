import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PostForm } from '../components/form'
import { Timeline } from '../components/timeline'
import { LightBox, triggerLightBox } from '../components/ui'
import { setImageClickHandler, clearImageClickHandler } from '../lib/parser'
import { getString, setString, removeItem, getUIThemeColors, applyThemeColors, parseSearchParams } from '../lib/utils'
import { fetchEventById } from '../lib/nostr/relay'
import { getFullContentForEdit } from '../lib/nostr/tags'
import { STORAGE_KEYS, CUSTOM_EVENTS, TIMEOUTS } from '../lib/constants'
import type { Event, SearchFilters } from '../types'

interface HomePageProps {
  // Optional filters from parent (e.g., TagPage)
  filters?: SearchFilters
}

export function HomePage({ filters: propFilters }: HomePageProps = {}) {
  const [searchParams] = useSearchParams()

  // Use prop filters if provided, otherwise parse from URL
  const activeFilters = propFilters || parseSearchParams(searchParams)
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

  // Handle edit/reply URL parameters
  useEffect(() => {
    const editId = searchParams.get('edit')
    const replyId = searchParams.get('reply')

    if (editId) {
      fetchEventById(editId).then((event) => {
        if (event) {
          setEditingEvent(event)
          setReplyingTo(null)
          // Use full content for editing (expand teaser)
          setContent(getFullContentForEdit(event))
        }
      })
    } else if (replyId) {
      fetchEventById(replyId).then((event) => {
        if (event) {
          setReplyingTo(event)
          setEditingEvent(null)
          setContent('')
        }
      })
    }
  }, [searchParams])

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

  const handleEditStart = useCallback((event: Event) => {
    setEditingEvent(event)
    setReplyingTo(null)
    // Use full content for editing (expand teaser)
    setContent(getFullContentForEdit(event))
  }, [])

  const handleEditCancel = useCallback(() => {
    setEditingEvent(null)
    setContent('')
  }, [])

  const handleEditComplete = useCallback(() => {
    setEditingEvent(null)
    setContent('')
  }, [])

  const handleReplyStart = useCallback((event: Event) => {
    setReplyingTo(event)
    setEditingEvent(null)
    setContent('')
  }, [])

  const handleReplyCancel = useCallback(() => {
    setReplyingTo(null)
    setContent('')
  }, [])

  const handleReplyComplete = useCallback(() => {
    setReplyingTo(null)
    setContent('')
  }, [])

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
        <Timeline onEditStart={handleEditStart} onReplyStart={handleReplyStart} filters={activeFilters} />
      </div>
      <LightBox />
    </>
  )
}
