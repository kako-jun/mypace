import { Icon, Avatar, TextButton, CopyButton, ExternalLink } from '../ui'
import { getWebsites, getWebsiteIcon } from '../../lib/utils'
import { nip19 } from 'nostr-tools'
import type { LoadableProfile, ThemeColors } from '../../types'
import type { UserSerialData } from '../../lib/api'
import { getThemeCardProps } from '../../lib/nostr/events'
import { SerialBadge } from './SerialBadge'

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
          {isOwnProfile && (
            <TextButton variant="primary" className="edit-button" onClick={onEditClick}>
              EDIT
            </TextButton>
          )}
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
          <span>{postsCount !== null ? postsCount : '...'} posts</span>
        </div>
      </div>
    </div>
  )
}
