import { Icon, Avatar, TextButton } from '../ui'
import { getWebsites, getWebsiteIcon } from '../../lib/utils'
import { nip19 } from 'nostr-tools'
import type { Profile, ThemeColors } from '../../types'
import { getThemeCardProps } from '../../lib/nostr/events'

interface UserProfileProps {
  profile: Profile | null | undefined
  pubkey: string
  displayName: string
  avatarUrl: string | null
  themeColors: ThemeColors | null
  isOwnProfile: boolean
  nip05Verified: boolean | null
  npubCopied: boolean
  postsCount: number
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
            <h2 className="user-name">{displayName}</h2>
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
            <a
              key={i}
              href={w.url.match(/^https?:\/\//) ? w.url : `https://${w.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="user-link"
            >
              <Icon name={getWebsiteIcon(w.label)} size={14} />{' '}
              {w.label !== 'Website' ? w.label : w.url.replace(/^https?:\/\//, '')}
            </a>
          ))}
          {profile?.lud16 && (
            <span className="user-link user-lightning">
              <Icon name="Zap" size={14} /> {profile.lud16}
            </span>
          )}
        </div>

        <div className="user-npub-row">
          <span className="user-npub">{npub}</span>
          <button className="npub-copy-btn" onClick={onCopyNpub} aria-label="Copy npub">
            {npubCopied ? <Icon name="Check" size={14} /> : <Icon name="Copy" size={14} />}
          </button>
        </div>

        <div className="user-stats">
          <span>{postsCount} posts</span>
        </div>
      </div>
    </div>
  )
}
