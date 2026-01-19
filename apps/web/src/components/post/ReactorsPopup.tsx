import { createPortal } from 'react-dom'
import { Icon, CloseButton } from '../ui'
import { STELLA_COLORS, getTotalStellaCount, type StellaColor, type StellaCountsByColor } from '../../lib/nostr/events'

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
  onRemove: () => void
  onClose: (e?: React.MouseEvent) => void
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
}: ReactorsPopupProps) {
  // Check if current user can remove (only yellow stella can be removed)
  const myReactor = reactors.find((r) => r.pubkey === myPubkey)
  const canRemove =
    myReactor &&
    myReactor.stella.yellow > 0 &&
    myReactor.stella.green === 0 &&
    myReactor.stella.red === 0 &&
    myReactor.stella.blue === 0 &&
    myReactor.stella.purple === 0

  return createPortal(
    <>
      <div className="reactors-popup-overlay" onClick={onClose} />
      <div
        className="reactors-popup"
        style={{ top: position.top, left: position.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="reactors-popup-header">
          <span className="reactors-popup-title">Stella</span>
          <CloseButton onClick={() => onClose()} size={16} />
        </div>
        <div className="reactors-list">
          {reactors.map((reactor) => {
            const totalStella = getTotalStellaCount(reactor.stella)
            const activeColors = COLOR_ORDER.filter((c) => reactor.stella[c] > 0)
            const isMe = reactor.pubkey === myPubkey

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
                  {activeColors.length > 1 && <span className="reactor-stella-total">({totalStella})</span>}
                </span>
                {isMe && canRemove && (
                  <button className="reactor-remove" onClick={onRemove}>
                    取消
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
