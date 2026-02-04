import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { PostForm } from '../components/form'
import { Timeline } from '../components/timeline'
import { LightBox, triggerLightBox } from '../components/ui'
import { MyStatsWidget } from '../components/stats/MyStatsWidget'
import { useCelebration } from '../components/supernova'
import { ShareChoiceModal } from '../components/npc'
import { setImageClickHandler, clearImageClickHandler } from '../lib/parser'
import { getDraft, setDraft, getDraftReplyTo, setDraftReplyTo, clearDraft } from '../lib/storage'
import { consumeShareTargetImage } from '../lib/storage/share-target'
import { fetchEventById } from '../lib/nostr/relay'
import { getCurrentPubkey } from '../lib/nostr/events'
import { getFullContentForEdit } from '../lib/nostr/tags'
import { checkSupernovas } from '../lib/api'
import { CUSTOM_EVENTS, TIMEOUTS, LIMITS } from '../lib/constants'
import type { Event } from '../types'

export function HomePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [longMode, setLongMode] = useState(false)
  const [content, setContent] = useState(() => getDraft())
  const [sharedImageFile, setSharedImageFile] = useState<File | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [replyingTo, setReplyingTo] = useState<Event | null>(null)
  const [shareChoiceModal, setShareChoiceModal] = useState<{ url: string; text: string } | null>(null)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { celebrate } = useCelebration()

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

  // Check and unlock supernovas on page load
  useEffect(() => {
    getCurrentPubkey()
      .then((pubkey) => checkSupernovas(pubkey))
      .then((result) => {
        if (result.newlyUnlocked.length > 0) {
          celebrate(result.newlyUnlocked)
        }
      })
      .catch(() => {
        // Ignore errors (user might not be logged in)
      })
  }, [celebrate])

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

  // Handle Web Share Target API (shared image from Android)
  useEffect(() => {
    const shareImage = searchParams.get('share_image')
    if (shareImage === 'pending') {
      consumeShareTargetImage().then((file) => {
        if (file) {
          setSharedImageFile(file)
        }
      })
      // Remove parameter from URL
      navigate('/', { replace: true })
    }
  }, [searchParams, navigate])

  // Handle Web Share Target API (shared URL choice - reporter vs self post)
  useEffect(() => {
    const shareChoice = searchParams.get('share_choice')
    if (shareChoice === 'pending') {
      const sharedUrl = searchParams.get('shared_url') || ''
      const sharedText = searchParams.get('shared_text') || ''
      if (sharedUrl) {
        setShareChoiceModal({ url: sharedUrl, text: sharedText })
      }
      // Remove parameters from URL
      navigate('/', { replace: true })
    }
  }, [searchParams, navigate])

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

  const handleSharedImageProcessed = useCallback(() => {
    setSharedImageFile(null)
  }, [])

  if (longMode) {
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
          sharedImageFile={sharedImageFile}
          onSharedImageProcessed={handleSharedImageProcessed}
        />
        <MyStatsWidget />
        <ShareChoiceModal
          isOpen={!!shareChoiceModal}
          onClose={() => setShareChoiceModal(null)}
          sharedUrl={shareChoiceModal?.url || ''}
          sharedText={shareChoiceModal?.text || ''}
        />
      </>
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
        sharedImageFile={sharedImageFile}
        onSharedImageProcessed={handleSharedImageProcessed}
      />
      <div className="container">
        <Timeline onEditStart={handleEditStart} onReplyStart={handleReplyStart} />
      </div>
      <LightBox />
      <MyStatsWidget />
      <ShareChoiceModal
        isOpen={!!shareChoiceModal}
        onClose={() => setShareChoiceModal(null)}
        sharedUrl={shareChoiceModal?.url || ''}
        sharedText={shareChoiceModal?.text || ''}
      />
    </>
  )
}
