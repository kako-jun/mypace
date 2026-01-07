import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { Icon } from '../ui'
import '../../styles/components/post-actions.css'
import ReactorsPopup from './ReactorsPopup'
import RepostConfirmPopup from './RepostConfirmPopup'
import ShareMenu, { type ShareOption } from './ShareMenu'
import { MAX_STELLA_PER_USER } from '../../lib/nostr/events'
import type { ReactionData, ReplyData, RepostData } from '../../types'

interface PostActionsProps {
  isMyPost: boolean
  reactions: ReactionData | undefined
  replies: ReplyData | undefined
  reposts: RepostData | undefined
  likingId: string | null
  repostingId: string | null
  eventId: string
  copied: boolean
  myPubkey: string | null
  getDisplayName: (pubkey: string) => string
  onLike: () => void
  onUnlike: () => void
  onReply: () => void
  onRepost: () => void
  onShareOption: (option: ShareOption) => void
  onNavigateToProfile: (pubkey: string) => void
}

const LONG_PRESS_DURATION = 500 // ms

export default function PostActions({
  isMyPost,
  reactions,
  replies,
  reposts,
  likingId,
  repostingId,
  eventId,
  copied,
  myPubkey,
  getDisplayName,
  onLike,
  onUnlike,
  onReply,
  onRepost,
  onShareOption,
  onNavigateToProfile,
}: PostActionsProps) {
  // Random delay for stella spin animation (0-42 seconds)
  const stellaDelay = useMemo(() => Math.random() * 42, [])

  // Long press handling - show reactors list
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = useRef(false)
  const [showReactorsPopup, setShowReactorsPopup] = useState(false)
  const buttonWrapperRef = useRef<HTMLDivElement>(null)
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null)

  // Share menu state
  const [showShareMenu, setShowShareMenu] = useState(false)
  const shareButtonRef = useRef<HTMLDivElement>(null)
  const [shareMenuPosition, setShareMenuPosition] = useState<{ top: number; left: number } | null>(null)

  // Repost confirm state
  const [showRepostConfirm, setShowRepostConfirm] = useState(false)
  const repostButtonRef = useRef<HTMLDivElement>(null)
  const [repostConfirmPosition, setRepostConfirmPosition] = useState<{ top: number; left: number } | null>(null)

  const myStella = reactions?.myStella || 0
  const canAddMoreStella = myStella < MAX_STELLA_PER_USER
  const isLiking = likingId === eventId
  const reactors = reactions?.reactors || []

  // Update popup position when shown (above-right of the stella button)
  useEffect(() => {
    if (showReactorsPopup && buttonWrapperRef.current) {
      const rect = buttonWrapperRef.current.getBoundingClientRect()
      setPopupPosition({
        top: rect.top + window.scrollY,
        left: rect.right + window.scrollX,
      })
    } else {
      // Reset position when closed
      setPopupPosition(null)
    }
  }, [showReactorsPopup])

  const handleMouseDown = useCallback(() => {
    // Show reactors popup on long press if there are any reactors
    if (reactors.length === 0) return

    isLongPress.current = false
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true
      setShowReactorsPopup(true)
    }, LONG_PRESS_DURATION)
  }, [reactors.length])

  const handleMouseUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const handleClick = useCallback(() => {
    // If long press was triggered, don't handle as click
    if (isLongPress.current) {
      isLongPress.current = false
      return
    }

    // If popup is shown, don't handle as click
    if (showReactorsPopup) return

    // Normal click - add a stella (only for non-own posts)
    if (!isMyPost && canAddMoreStella) {
      onLike()
    }
  }, [isMyPost, canAddMoreStella, onLike, showReactorsPopup])

  const handleUnlikeConfirm = useCallback(() => {
    setShowReactorsPopup(false)
    onUnlike()
  }, [onUnlike])

  // Click on count to show popup (PC-friendly alternative to long press)
  const handleCountClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (reactors.length > 0) {
        setShowReactorsPopup(true)
      }
    },
    [reactors.length]
  )

  const handleClosePopup = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setShowReactorsPopup(false)
  }, [])

  // Share menu position calculation (above the button)
  useEffect(() => {
    if (showShareMenu && shareButtonRef.current) {
      const rect = shareButtonRef.current.getBoundingClientRect()
      setShareMenuPosition({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      })
    } else {
      setShareMenuPosition(null)
    }
  }, [showShareMenu])

  // Repost confirm position calculation (above the button, centered)
  useEffect(() => {
    if (showRepostConfirm && repostButtonRef.current) {
      const rect = repostButtonRef.current.getBoundingClientRect()
      setRepostConfirmPosition({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      })
    } else {
      setRepostConfirmPosition(null)
    }
  }, [showRepostConfirm])

  const handleShareClick = useCallback(() => {
    setShowShareMenu(true)
  }, [])

  const handleShareMenuClose = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setShowShareMenu(false)
  }, [])

  const handleShareSelect = useCallback(
    (option: ShareOption) => {
      setShowShareMenu(false)
      onShareOption(option)
    },
    [onShareOption]
  )

  // Repost handlers
  const handleRepostClick = useCallback(() => {
    setShowRepostConfirm(true)
  }, [])

  const handleRepostConfirm = useCallback(() => {
    setShowRepostConfirm(false)
    onRepost()
  }, [onRepost])

  const handleRepostCancel = useCallback(() => {
    setShowRepostConfirm(false)
  }, [])

  // Render count with loading/normal states
  const renderCount = (
    data: { count: number } | undefined,
    clickable?: boolean,
    onClick?: (e: React.MouseEvent) => void
  ) => {
    if (data === undefined) {
      // Loading state - subtle dot (not clickable)
      return <span className="action-count action-count-loading">・</span>
    }
    // Only make clickable if count > 0 (there are reactors to show)
    const isClickable = clickable && data.count > 0
    return (
      <span
        className={`action-count ${isClickable ? 'action-count-clickable' : ''}`}
        onClick={isClickable ? onClick : undefined}
      >
        {data.count}
      </span>
    )
  }

  // Reactors popup component rendered via portal (only when position is calculated)
  const reactorsPopup =
    showReactorsPopup && popupPosition ? (
      <ReactorsPopup
        reactors={reactors}
        position={popupPosition}
        myPubkey={myPubkey}
        getDisplayName={getDisplayName}
        onNavigateToProfile={onNavigateToProfile}
        onRemove={handleUnlikeConfirm}
        onClose={handleClosePopup}
      />
    ) : null

  // Reactors are already sorted by newest first from API

  return (
    <>
      {!isMyPost && (
        <div className="like-button-wrapper" ref={buttonWrapperRef}>
          <button
            className={`icon-button like-button ${reactions?.myReaction ? 'liked' : ''}`}
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            disabled={isLiking || !reactions || (!canAddMoreStella && !reactions.myReaction)}
            aria-label={reactions?.myReaction ? `${myStella} stella given` : 'Give a stella'}
          >
            <span className="action-stella" style={{ animationDelay: `${stellaDelay}s` }}>
              {reactions?.myReaction ? (
                <Icon name="Star" size={20} fill="currentColor" />
              ) : (
                <Icon name="Star" size={20} />
              )}
            </span>
            {renderCount(reactions, true, handleCountClick)}
          </button>
          {reactorsPopup}
        </div>
      )}
      {isMyPost && (
        <div className="like-button-wrapper" ref={buttonWrapperRef}>
          <button
            className="icon-button like-button"
            onClick={() => setShowReactorsPopup(true)}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            disabled={reactors.length === 0}
            aria-label="View who gave stella"
          >
            <span className="action-stella" style={{ animationDelay: `${stellaDelay}s` }}>
              <Icon name="Star" size={20} />
            </span>
            {renderCount(reactions)}
          </button>
          {reactorsPopup}
        </div>
      )}

      <button className="icon-button reply-button" onClick={onReply} aria-label="Reply to this post">
        <Icon name="MessageCircle" size={20} />
        {renderCount(replies)}
      </button>

      <div className="repost-button-wrapper" ref={repostButtonRef}>
        <button
          className={`icon-button repost-button ${reposts?.myRepost ? 'reposted' : ''}`}
          onClick={handleRepostClick}
          disabled={repostingId === eventId || reposts?.myRepost}
          aria-label={reposts?.myRepost ? 'Reposted' : 'Repost this post'}
        >
          <Icon name="Repeat2" size={20} />
          {renderCount(reposts)}
        </button>
        {showRepostConfirm && repostConfirmPosition && (
          <RepostConfirmPopup
            position={repostConfirmPosition}
            onConfirm={handleRepostConfirm}
            onClose={handleRepostCancel}
          />
        )}
      </div>

      <div className="share-button-wrapper" ref={shareButtonRef}>
        <button
          className={`icon-button share-button ${copied ? 'copied' : ''}`}
          onClick={handleShareClick}
          aria-label="Share this post"
        >
          {copied ? <Icon name="Check" size={20} /> : <Icon name="Share2" size={20} />}
        </button>
        {showShareMenu && shareMenuPosition && (
          <ShareMenu position={shareMenuPosition} onSelect={handleShareSelect} onClose={handleShareMenuClose} />
        )}
      </div>
    </>
  )
}
