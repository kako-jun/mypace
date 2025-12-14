import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../ui'
import { MAX_STARS_PER_USER } from '../../lib/nostr/events'
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
  onShare: () => void
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
  onShare,
  onNavigateToProfile,
}: PostActionsProps) {
  // Random delay for star spin animation (0-42 seconds)
  const starDelay = useMemo(() => Math.random() * 42, [])

  // Long press handling - show reactors list
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongPress = useRef(false)
  const [showReactorsPopup, setShowReactorsPopup] = useState(false)
  const buttonWrapperRef = useRef<HTMLDivElement>(null)
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null)

  const myStars = reactions?.myStars || 0
  const canAddMoreStars = myStars < MAX_STARS_PER_USER
  const isLiking = likingId === eventId
  const reactors = reactions?.reactors || []

  // Update popup position when shown (below the post card, slightly overlapping)
  useEffect(() => {
    if (showReactorsPopup && buttonWrapperRef.current) {
      // Find parent post-card element
      const postCard = buttonWrapperRef.current.closest('.post-card')
      if (postCard) {
        const cardRect = postCard.getBoundingClientRect()
        setPopupPosition({
          top: cardRect.bottom + window.scrollY - 32, // Overlap by 32px
          left: cardRect.left + cardRect.width / 2 + window.scrollX, // Center of card
        })
      } else {
        // Fallback to button position
        const rect = buttonWrapperRef.current.getBoundingClientRect()
        setPopupPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + rect.width / 2 + window.scrollX,
        })
      }
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

    // Normal click - add a star (only for non-own posts)
    if (!isMyPost && canAddMoreStars) {
      onLike()
    }
  }, [isMyPost, canAddMoreStars, onLike, showReactorsPopup])

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
    showReactorsPopup && popupPosition
      ? createPortal(
          <>
            <div className="reactors-popup-overlay" onClick={handleClosePopup} />
            <div
              className="reactors-popup"
              style={{ top: popupPosition.top, left: popupPosition.left }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="reactors-popup-header">
                <span className="reactors-popup-title">Stella</span>
                <button className="reactors-popup-close" onClick={handleClosePopup}>
                  <Icon name="X" size={16} />
                </button>
              </div>
              <div className="reactors-list">
                {reactors.map((reactor) => (
                  <div key={reactor.pubkey} className="reactor-item">
                    <span className="reactor-name" onClick={() => onNavigateToProfile(reactor.pubkey)}>
                      {getDisplayName(reactor.pubkey)}
                    </span>
                    <span className="reactor-stars">
                      <Icon name="Star" size={14} fill="#f1c40f" />
                      {reactor.stars}
                    </span>
                    {reactor.pubkey === myPubkey && (
                      <button className="reactor-remove" onClick={handleUnlikeConfirm}>
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>,
          document.body
        )
      : null

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
            disabled={isLiking || !reactions || (!canAddMoreStars && !reactions.myReaction)}
            aria-label={reactions?.myReaction ? `${myStars} stars given` : 'Give a star'}
          >
            <span className="action-star" style={{ animationDelay: `${starDelay}s` }}>
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
            aria-label="View who gave stars"
          >
            <span className="action-star" style={{ animationDelay: `${starDelay}s` }}>
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

      <button
        className={`icon-button repost-button ${reposts?.myRepost ? 'reposted' : ''}`}
        onClick={onRepost}
        disabled={repostingId === eventId || reposts?.myRepost}
        aria-label={reposts?.myRepost ? 'Reposted' : 'Repost this post'}
      >
        <Icon name="Repeat2" size={20} />
        {renderCount(reposts)}
      </button>

      <button
        className={`icon-button share-button ${copied ? 'copied' : ''}`}
        onClick={onShare}
        aria-label="Share this post"
      >
        {copied ? <Icon name="Check" size={20} /> : <Icon name="Share2" size={20} />}
      </button>
    </>
  )
}
