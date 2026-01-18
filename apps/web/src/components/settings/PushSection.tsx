import { useEffect, useState } from 'react'
import { SettingsSection, Toggle } from '../ui'
import { usePushNotifications, type PushPreference } from '../../hooks'
import { getStoredSecretKey, getPublicKeyFromSecret, hasNip07, getNip07PublicKey } from '../../lib/nostr/keys'

export default function PushSection() {
  const [pubkey, setPubkey] = useState<string | null>(null)

  // Get pubkey on mount
  useEffect(() => {
    const init = async () => {
      if (hasNip07()) {
        const pk = await getNip07PublicKey()
        if (pk) {
          setPubkey(pk)
          return
        }
      }

      const sk = getStoredSecretKey()
      if (sk) {
        setPubkey(getPublicKeyFromSecret(sk))
      }
    }
    init()
  }, [])

  const { supported, permission, subscribed, preference, loading, error, subscribe, unsubscribe, updatePreference } =
    usePushNotifications(pubkey)

  // Handle toggle
  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      await subscribe('all')
    } else {
      await unsubscribe()
    }
  }

  // Handle preference change
  const handlePreferenceChange = async (pref: PushPreference) => {
    await updatePreference(pref)
  }

  // Not supported
  if (!supported) {
    return (
      <SettingsSection title="Push Notifications">
        <p className="settings-note">Push notifications are not supported in this browser.</p>
      </SettingsSection>
    )
  }

  // Permission denied
  if (permission === 'denied') {
    return (
      <SettingsSection title="Push Notifications">
        <p className="settings-note">Notifications are blocked. Please enable them in your browser settings.</p>
      </SettingsSection>
    )
  }

  return (
    <SettingsSection title="Push Notifications">
      <div className="push-toggle-row">
        <Toggle checked={subscribed} onChange={handleToggle} disabled={loading} label="Enable push notifications" />
      </div>

      {subscribed && (
        <div className="push-preference-options">
          <label className="push-preference-option">
            <input
              type="radio"
              name="push-preference"
              checked={preference === 'all'}
              onChange={() => handlePreferenceChange('all')}
              disabled={loading}
            />
            <span>All notifications</span>
            <span className="push-preference-desc">Stella, replies, and reposts</span>
          </label>
          <label className="push-preference-option">
            <input
              type="radio"
              name="push-preference"
              checked={preference === 'replies_only'}
              onChange={() => handlePreferenceChange('replies_only')}
              disabled={loading}
            />
            <span>Replies only</span>
            <span className="push-preference-desc">Only notify for replies</span>
          </label>
        </div>
      )}

      {error && <p className="settings-error">{error}</p>}

      <p className="settings-note">Get notified when someone reacts to your posts, even when MY PACE is closed.</p>
    </SettingsSection>
  )
}
