import { SettingsSection, ExternalLink } from '../ui'

export default function ShareSection() {
  return (
    <>
      <SettingsSection title="Share App">
        <div className="share-app-qr">
          <img src="/qr-mypace.webp" alt="QR Code" width="120" height="120" />
        </div>
        <p className="hint">Scan to open this app</p>
      </SettingsSection>

      <SettingsSection title="Notice" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <ul className="notice-list">
          <li>This app is provided as-is without warranty. Use at your own risk.</li>
          <li>
            Images are uploaded to nostr.build. Once uploaded, files cannot be deleted due to the decentralized nature
            of Nostr. Please choose files carefully before uploading.
          </li>
        </ul>
      </SettingsSection>

      <div className="settings-footer">
        <ExternalLink href="https://github.com/kako-jun/mypace">GitHub</ExternalLink>
      </div>
    </>
  )
}
