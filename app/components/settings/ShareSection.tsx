export default function ShareSection() {
  return (
    <>
      <div class="settings-section">
        <h3>Share App</h3>
        <div class="share-app-qr">
          <img src="/qr-mypace.webp" alt="QR Code" width="120" height="120" />
        </div>
        <p class="hint">Scan to open this app</p>
      </div>

      <div class="settings-section" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
        <h3>Notice</h3>
        <ul class="notice-list">
          <li>This app is provided as-is without warranty. Use at your own risk.</li>
          <li>Images uploaded to Nostr cannot be deleted due to the protocol's design.</li>
        </ul>
      </div>

      <div class="settings-footer">
        <a href="https://github.com/kako-jun/mypace" target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
      </div>
    </>
  )
}
