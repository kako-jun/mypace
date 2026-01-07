import { SettingsSection, ExternalLink, Icon } from '../ui'

export default function ShareSection() {
  return (
    <>
      {/* App Info */}
      <div className="about-app">
        <div className="about-app-logo">
          <span className="logo-text">
            MY<span className="logo-star">★</span>
          </span>
          <span className="logo-text">PACE</span>
        </div>
        <p className="about-app-description">マイペースでいいミディアムレアSNS</p>
        <p className="about-author">
          <span>Author:</span>
          <strong>kako-jun</strong>
          <a
            href="https://github.com/kako-jun/mypace"
            target="_blank"
            rel="noopener noreferrer"
            title="GitHub"
            className="author-link"
          >
            <Icon name="Github" size={18} />
          </a>
          <a
            href="https://llll-ll.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Homepage"
            className="author-link"
          >
            <Icon name="Home" size={18} />
          </a>
        </p>
        <div className="sponsor-section">
          <a
            href="https://github.com/sponsors/kako-jun"
            target="_blank"
            rel="noopener noreferrer"
            className="sponsor-link"
          >
            <Icon name="Heart" size={18} className="heart-icon" />
            <span>Sponsor on GitHub</span>
          </a>
        </div>
      </div>

      <SettingsSection title="Share App">
        <div className="share-app-qr">
          <img src="/qr-mypace.webp" alt="QR Code" width="120" height="120" />
        </div>
        <p className="hint" style={{ textAlign: 'center' }}>
          Scan to open this app
        </p>
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
