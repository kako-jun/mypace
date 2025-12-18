export default function ShareSection() {
  return (
    <>
      <div className="settings-section">
        <h3>Share App</h3>
        <div className="share-app-qr">
          <img src="/qr-mypace.webp" alt="QR Code" width="120" height="120" />
        </div>
        <p className="hint">Scan to open this app</p>
      </div>

      <div className="settings-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <h3>Notice</h3>
        <ul className="notice-list">
          <li>This app is provided as-is without warranty. Use at your own risk.</li>
          <li>
            Images are uploaded to nostr.build. Once uploaded, files cannot be deleted due to the decentralized nature
            of Nostr. Please choose files carefully before uploading.
          </li>
        </ul>
      </div>

      <div className="settings-footer">
        <a href="https://github.com/kako-jun/mypace" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
    </>
  )
}
