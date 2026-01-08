import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PostForm } from '../components/form'
import { Timeline } from '../components/timeline'
import { LightBox, triggerLightBox } from '../components/ui'
import { setImageClickHandler, clearImageClickHandler } from '../lib/parser'
import { getUIThemeColors, applyThemeColors } from '../lib/utils'
import { getDraft, setDraft, getDraftReplyTo, setDraftReplyTo, clearDraft } from '../lib/storage'
import { fetchEventById } from '../lib/nostr/relay'
import { getFullContentForEdit } from '../lib/nostr/tags'
import { CUSTOM_EVENTS, TIMEOUTS, LIMITS } from '../lib/constants'
import type { Event } from '../types'

export function HomePage() {
  const [searchParams] = useSearchParams()
  const [longMode, setLongMode] = useState(false)
  const [content, setContent] = useState(() => getDraft())
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
        setDraft(content)
        // Save reply target id if replying
        if (replyingTo) {
          setDraftReplyTo(replyingTo.id)
        } else {
          setDraftReplyTo('')
        }
      } else {
        clearDraft()
      }
    }, TIMEOUTS.DRAFT_SAVE_DELAY)

    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current)
      }
    }
  }, [content, replyingTo])

  // Clear draft when a new post is successfully published
  useEffect(() => {
    const handleNewPost = () => {
      clearDraft()
    }
    window.addEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
    return () => window.removeEventListener(CUSTOM_EVENTS.NEW_POST, handleNewPost)
  }, [])

  // Apply theme colors on initial load
  useEffect(() => {
    applyThemeColors(getUIThemeColors())
  }, [])

  // Handle edit/reply/share URL parameters or restore from localStorage
  useEffect(() => {
    const editId = searchParams.get('edit')
    const replyId = searchParams.get('reply')
    const shareText = searchParams.get('text')

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
    } else if (shareText) {
      // Intent share: set text from URL parameter (truncate if too long)
      const truncated =
        shareText.length > LIMITS.MAX_POST_LENGTH ? shareText.slice(0, LIMITS.MAX_POST_LENGTH) : shareText
      setContent(truncated)
      setEditingEvent(null)
      setReplyingTo(null)
    } else {
      // Restore reply target from localStorage if no URL params
      const savedReplyToId = getDraftReplyTo()
      if (savedReplyToId) {
        fetchEventById(savedReplyToId).then((event) => {
          if (event) {
            setReplyingTo(event)
          } else {
            // Reply target not found, clear draft to prevent accidental non-reply post
            clearDraft()
            setContent('')
          }
        })
      }
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
        <Timeline onEditStart={handleEditStart} onReplyStart={handleReplyStart} />
      </div>
      <LightBox />
    </>
  )
}
