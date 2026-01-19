import { Icon, Avatar, TextButton, CopyButton, ExternalLink } from '../ui'
import { getWebsites, getWebsiteIcon, formatNumber } from '../../lib/utils'
import { nip19 } from 'nostr-tools'
import type { LoadableProfile, ThemeColors } from '../../types'
import type { UserSerialData, StellaByColor } from '../../lib/api'
import { getThemeCardProps } from '../../lib/nostr/events'
import { SerialBadge } from './SerialBadge'

// Stella colors for display
const STELLA_COLORS: Array<{ key: keyof StellaByColor; fill: string }> = [
  { key: 'yellow', fill: '#f1c40f' },
  { key: 'green', fill: '#2ecc71' },
  { key: 'red', fill: '#e74c3c' },
  { key: 'blue', fill: '#3498db' },
  { key: 'purple', fill: '#9b59b6' },
]

interface UserProfileProps {
  profile: LoadableProfile
  pubkey: string
  displayName: string
  avatarUrl: string | null
  themeColors: ThemeColors | null
  isOwnProfile: boolean
  nip05Verified: boolean | null
  npubCopied: boolean
  postsCount: number | null
  stellaCount: number | null
  stellaByColor: StellaByColor | null
  viewsCount: { details: number; impressions: number } | null
  serialData: UserSerialData | null
  onCopyNpub: () => void
  onEditClick: () => void
}

export function UserProfile({
  profile,
  pubkey,
  displayName,
  avatarUrl,
  themeColors,
  isOwnProfile,
  nip05Verified,
  npubCopied,
  postsCount,
  stellaCount,
  stellaByColor,
  viewsCount,
  serialData,
  onCopyNpub,
  onEditClick,
}: UserProfileProps) {
  // Safely encode pubkey to npub
  let npub: string
  try {
    npub = pubkey.length === 64 ? nip19.npubEncode(pubkey) : pubkey
  } catch {
    npub = pubkey
  }

  const themeProps = themeColors ? getThemeCardProps(themeColors) : { className: '', style: {} }

  return (
    <div className="user-profile-card-wrapper">
      {/* Banner */}
      {profile?.banner && (
        <div className="user-banner">
          <img src={profile.banner} alt="Banner" />
        </div>
      )}

      <div className={`user-profile-card ${themeProps.className}`} style={themeProps.style}>
        {/* Edit button - positioned at top-right of profile card */}
        {isOwnProfile && (
          <TextButton variant="primary" className="edit-button" onClick={onEditClick}>
            EDIT
          </TextButton>
        )}
        <div className="user-profile-header">
          <Avatar src={avatarUrl} className="user-avatar" />
          <div className="user-info">
            <div className="user-name-row">
              <h2 className="user-name">{displayName}</h2>
              {serialData?.serial && serialData.visible !== false && <SerialBadge serial={serialData.serial} />}
            </div>
            {profile?.nip05 && (
              <span
                className={`user-nip05 ${nip05Verified === true ? 'verified' : nip05Verified === false ? 'unverified' : ''}`}
              >
                {nip05Verified === true ? (
                  <Icon name="CheckCircle" size={14} />
                ) : nip05Verified === false ? (
                  <Icon name="XCircle" size={14} />
                ) : (
                  <span className="verifying">...</span>
                )}{' '}
                {profile.nip05}
              </span>
            )}
          </div>
        </div>

        {profile?.about && <p className="user-about">{profile.about}</p>}

        <div className="user-links">
          {getWebsites(profile).map((w, i) => (
            <ExternalLink key={i} href={w.url.match(/^https?:\/\//) ? w.url : `https://${w.url}`} className="user-link">
              <Icon name={getWebsiteIcon(w.label)} size={14} />{' '}
              {w.label !== 'Website' ? w.label : w.url.replace(/^https?:\/\//, '')}
            </ExternalLink>
          ))}
          {profile?.lud16 && (
            <span className="user-link user-lightning">
              <Icon name="Zap" size={14} /> {profile.lud16}
            </span>
          )}
        </div>

        <div className="user-npub-row">
          <span className="user-npub">{npub}</span>
          <CopyButton copied={npubCopied} onClick={onCopyNpub} className="npub-copy-btn" aria-label="Copy npub" />
        </div>

        <div className="user-stats">
          <div className="user-stats-row">
            <span>{formatNumber(postsCount)} posts</span>
            <span>
              <Icon name="BarChart2" size={14} />{' '}
              {viewsCount !== null
                ? `${formatNumber(viewsCount.details)} / ${formatNumber(viewsCount.impressions)}`
                : '...'}
            </span>
          </div>
          <div className="user-stats-row user-stella-row">
            {stellaByColor && STELLA_COLORS.some((c) => c.key !== 'yellow' && stellaByColor[c.key] > 0) ? (
              STELLA_COLORS.map(
                ({ key, fill }) =>
                  stellaByColor[key] > 0 && (
                    <span key={key} className="user-stella-item">
                      <Icon name="Star" size={14} fill={fill} /> {formatNumber(stellaByColor[key])}
                    </span>
                  )
              )
            ) : (
              <span>
                <Icon name="Star" size={14} fill="#f1c40f" /> {formatNumber(stellaCount)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
