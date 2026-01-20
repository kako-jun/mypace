import { useMemo, useRef, useCallback, useState, useEffect } from 'react'
import { Icon } from '../ui'
import { formatNumber } from '../../lib/utils'
import '../../styles/components/post-actions.css'
import ReactorsPopup from './ReactorsPopup'
import RepostConfirmPopup from './RepostConfirmPopup'
import ShareMenu, { type ShareOption } from './ShareMenu'
import StellaColorPicker from './StellaColorPicker'
import { STELLA_COLORS, EMPTY_STELLA_COUNTS, type StellaColor, type StellaCountsByColor } from '../../lib/nostr/events'
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
  onAddStella: (color: StellaColor) => void
  onUnlike: () => void
  onReply: () => void
  onRepost: () => void
  onShareOption: (option: ShareOption) => void
  onNavigateToProfile: (pubkey: string) => void
}

const LONG_PRESS_DURATION = 500 // ms
const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

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
  onAddStella,
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
  const [showReactorsPopup, setShowReactorsPopup] = useState<StellaColor | null>(null)
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

  // Stella color picker state
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [colorPickerPosition, setColorPickerPosition] = useState<{ top: number; left: number } | null>(null)

  const myStella = reactions?.myStella || EMPTY_STELLA_COUNTS
  const totalMyStella = myStella.yellow + myStella.green + myStella.red + myStella.blue + myStella.purple
  const canAddMoreStella = totalMyStella < 10
  const isLiking = likingId === eventId
  const reactors = reactions?.reactors || []

  // Calculate total counts per color (from all reactors)
  const totalCountsByColor = useMemo(() => {
    const totals: StellaCountsByColor = { ...EMPTY_STELLA_COUNTS }
    for (const reactor of reactors) {
      for (const color of COLOR_ORDER) {
        totals[color] += reactor.stella[color]
      }
    }
    return totals
  }, [reactors])

  // Get reactors for a specific color
  const getReactorsByColor = useCallback(
    (color: StellaColor) => {
      return reactors.filter((r) => r.stella[color] > 0)
    },
    [reactors]
  )

  // Update popup position when shown (above-right of the stella button)
  useEffect(() => {
    if (showReactorsPopup && buttonWrapperRef.current) {
      const rect = buttonWrapperRef.current.getBoundingClientRect()
      setPopupPosition({
        top: rect.top,
        left: rect.right,
      })
      // Close popup on scroll (position: fixed doesn't follow scroll)
      const handleScroll = () => setShowReactorsPopup(null)
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
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
      // Long press shows yellow reactors (or first available color)
      const firstColorWithReactors = COLOR_ORDER.find((c) => totalCountsByColor[c] > 0)
      if (firstColorWithReactors) {
        setShowReactorsPopup(firstColorWithReactors)
      }
    }, LONG_PRESS_DURATION)
  }, [reactors.length, totalCountsByColor])

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
    if (showReactorsPopup || showColorPicker) return

    // Normal click - always show color picker (for adding, removing, or viewing reactors)
    setShowColorPicker(true)
  }, [showReactorsPopup, showColorPicker])

  const handleUnlikeConfirm = useCallback(() => {
    setShowReactorsPopup(null)
    onUnlike()
  }, [onUnlike])

  const handleClosePopup = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setShowReactorsPopup(null)
  }, [])

  // Share menu position calculation (above the button)
  useEffect(() => {
    if (showShareMenu && shareButtonRef.current) {
      const rect = shareButtonRef.current.getBoundingClientRect()
      setShareMenuPosition({
        top: rect.top,
        left: rect.left + rect.width / 2,
      })
      // Close menu on scroll
      const handleScroll = () => setShowShareMenu(false)
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    } else {
      setShareMenuPosition(null)
    }
  }, [showShareMenu])

  // Repost confirm position calculation (above the button, centered)
  useEffect(() => {
    if (showRepostConfirm && repostButtonRef.current) {
      const rect = repostButtonRef.current.getBoundingClientRect()
      setRepostConfirmPosition({
        top: rect.top,
        left: rect.left + rect.width / 2,
      })
      // Close popup on scroll
      const handleScroll = () => setShowRepostConfirm(false)
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    } else {
      setRepostConfirmPosition(null)
    }
  }, [showRepostConfirm])

  // Color picker position calculation (above-right of the stella button)
  useEffect(() => {
    if (showColorPicker && buttonWrapperRef.current) {
      const rect = buttonWrapperRef.current.getBoundingClientRect()
      setColorPickerPosition({
        top: rect.top,
        left: rect.right,
      })
      // Close picker on scroll
      const handleScroll = () => setShowColorPicker(false)
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => window.removeEventListener('scroll', handleScroll)
    } else {
      setColorPickerPosition(null)
    }
  }, [showColorPicker])

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

  // Color picker handlers
  const handleColorPickerClose = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
      e.preventDefault()
    }
    setShowColorPicker(false)
  }, [])

  const handleAddStella = useCallback(
    (color: StellaColor) => {
      onAddStella(color)
      // Don't close picker - allow rapid clicking
    },
    [onAddStella]
  )

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
        {formatNumber(data.count)}
      </span>
    )
  }

  // Reactors popup component - filtered by color
  const reactorsPopup =
    showReactorsPopup && popupPosition ? (
      <ReactorsPopup
        reactors={getReactorsByColor(showReactorsPopup)}
        position={popupPosition}
        myPubkey={myPubkey}
        getDisplayName={getDisplayName}
        onNavigateToProfile={onNavigateToProfile}
        onRemove={showReactorsPopup === 'yellow' ? handleUnlikeConfirm : undefined}
        onClose={handleClosePopup}
        filterColor={showReactorsPopup}
      />
    ) : null

  // Color picker component rendered via portal
  const colorPicker =
    showColorPicker && colorPickerPosition ? (
      <StellaColorPicker
        position={colorPickerPosition}
        currentCounts={myStella}
        totalCounts={totalCountsByColor}
        reactors={reactors}
        myPubkey={myPubkey}
        getDisplayName={getDisplayName}
        onNavigateToProfile={onNavigateToProfile}
        onAddStella={handleAddStella}
        onRemoveStella={reactions?.myReaction ? onUnlike : undefined}
        onClose={handleColorPickerClose}
        disabled={isMyPost}
      />
    ) : null

  // Render stella display with colored stars and counts
  const renderStellaDisplay = () => {
    // Loading state - show dot like replies/reposts
    if (reactions === undefined) {
      return (
        <>
          <span className="action-stella" style={{ animationDelay: `${stellaDelay}s` }}>
            <Icon name="Star" size={20} />
          </span>
          <span className="action-count action-count-loading">・</span>
        </>
      )
    }

    const hasAnyStella = reactors.length > 0

    if (!hasAnyStella) {
      // No stella yet - show single star with 0 count
      return (
        <>
          <span className="action-stella" style={{ animationDelay: `${stellaDelay}s` }}>
            <Icon name="Star" size={20} />
          </span>
          <span className="action-count">0</span>
        </>
      )
    }

    // Colors that have counts > 0
    const activeColors = COLOR_ORDER.filter((c) => totalCountsByColor[c] > 0)

    // Handle star icon click - show color picker
    const handleStarClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      if (canAddMoreStella || isMyPost) {
        setShowColorPicker(true)
      }
    }

    // Show colored stars with counts in a container
    return (
      <span className="stella-display-container">
        {activeColors.map((color) => (
          <span key={color} className="stella-display-item">
            <span className="stella-star-clickable" onClick={handleStarClick}>
              <Icon name="Star" size={20} fill={STELLA_COLORS[color].hex} />
            </span>
            <span className="action-count">{formatNumber(totalCountsByColor[color])}</span>
          </span>
        ))}
      </span>
    )
  }

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
            aria-label={reactions?.myReaction ? `${totalMyStella} stella given` : 'Give a stella'}
          >
            {renderStellaDisplay()}
          </button>
          {reactorsPopup}
          {colorPicker}
        </div>
      )}
      {isMyPost && (
        <div className="like-button-wrapper" ref={buttonWrapperRef}>
          <button
            className="icon-button like-button"
            onClick={handleClick}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
            disabled={false}
            aria-label="View who gave stella"
          >
            {renderStellaDisplay()}
          </button>
          {reactorsPopup}
          {colorPicker}
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
