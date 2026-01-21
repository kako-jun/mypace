import { createPortal } from 'react-dom'
import { Icon, CloseButton } from '../ui'
import { STELLA_COLORS, type StellaColor, type StellaCountsByColor } from '../../lib/nostr/events'

interface Reactor {
  pubkey: string
  stella: StellaCountsByColor
}

interface ReactorsPopupProps {
  reactors: Reactor[]
  position: { top: number; left: number }
  myPubkey: string | null
  getDisplayName: (pubkey: string) => string
  onNavigateToProfile: (pubkey: string) => void
  onRemove?: () => void
  onClose: (e?: React.MouseEvent) => void
  filterColor?: StellaColor // If set, only show this color's count
}

const COLOR_ORDER: StellaColor[] = ['yellow', 'green', 'red', 'blue', 'purple']

export default function ReactorsPopup({
  reactors,
  position,
  myPubkey,
  getDisplayName,
  onNavigateToProfile,
  onRemove,
  onClose,
  filterColor,
}: ReactorsPopupProps) {
  // Check if current user can remove (when viewing a color and user has that color stella)
  const myReactor = reactors.find((r) => r.pubkey === myPubkey)
  const canRemove = onRemove && filterColor && myReactor && myReactor.stella[filterColor] > 0

  // Title based on filter color
  const title = filterColor ? `${STELLA_COLORS[filterColor].label} Stella` : 'Stella'

  return createPortal(
    <>
      <div className="reactors-popup-overlay" onClick={onClose} />
      <div
        className="reactors-popup"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reactors-popup-header">
          <span className="reactors-popup-title">{title}</span>
          <CloseButton onClick={() => onClose()} size={16} />
        </div>
        <div className="reactors-list">
          {reactors.map((reactor) => {
            const isMe = reactor.pubkey === myPubkey

            // If filtering by color, show only that color's count
            if (filterColor) {
              const count = reactor.stella[filterColor]
              return (
                <div key={reactor.pubkey} className="reactor-item">
                  <span className="reactor-name" onClick={() => onNavigateToProfile(reactor.pubkey)}>
                    {getDisplayName(reactor.pubkey)}
                  </span>
                  <span className="reactor-stella-colors">
                    <span className="reactor-stella-color">
                      <Icon name="Star" size={12} fill={STELLA_COLORS[filterColor].hex} />
                      <span className="reactor-stella-count">{count}</span>
                    </span>
                  </span>
                  {isMe && canRemove && (
                    <button className="reactor-remove" onClick={onRemove}>
                      Remove
                    </button>
                  )}
                </div>
              )
            }

            // No filter - show all colors
            const activeColors = COLOR_ORDER.filter((c) => reactor.stella[c] > 0)

            return (
              <div key={reactor.pubkey} className="reactor-item">
                <span className="reactor-name" onClick={() => onNavigateToProfile(reactor.pubkey)}>
                  {getDisplayName(reactor.pubkey)}
                </span>
                <span className="reactor-stella-colors">
                  {activeColors.map((color) => (
                    <span key={color} className="reactor-stella-color">
                      <Icon name="Star" size={12} fill={STELLA_COLORS[color].hex} />
                      <span className="reactor-stella-count">{reactor.stella[color]}</span>
                    </span>
                  ))}
                </span>
                {isMe && canRemove && (
                  <button className="reactor-remove" onClick={onRemove}>
                    Remove
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}
