import { Avatar } from '../ui'
import { getCurrentPubkey } from '../../lib/nostr/events'
import { navigateToUser } from '../../lib/utils'
import { useState, useEffect } from 'react'

interface ProfileSectionProps {
  displayName: string
  pictureUrl: string
}

export default function ProfileSection({ displayName, pictureUrl }: ProfileSectionProps) {
  const [pubkey, setPubkey] = useState('')

  useEffect(() => {
    getCurrentPubkey()
      .then(setPubkey)
      .catch(() => {})
  }, [])

  const handleEditProfile = () => {
    if (pubkey) {
      navigateToUser(pubkey)
    }
  }

  return (
    <div className="settings-section">
      <h3>Profile</h3>
      <div className="profile-display">
        <Avatar src={pictureUrl} />
        <div className="profile-display-info">
          <span className="profile-display-name">{displayName || 'No name set'}</span>
          <button className="profile-edit-link" onClick={handleEditProfile} disabled={!pubkey}>
            Edit Profile →
          </button>
        </div>
      </div>
    </div>
  )
}
