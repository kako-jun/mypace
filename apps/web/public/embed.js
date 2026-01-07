/**
 * MYPACE Embed Card Web Component
 *
 * Usage:
 *   <script src="https://mypace.llll-ll.com/embed.js"></script>
 *   <mypace-card note="note1abc..."></mypace-card>
 *   <mypace-card latest></mypace-card>
 *   <mypace-card note="..." style="max-width: 400px;"></mypace-card>
 */
(function () {
  const MYPACE_URL = 'https://mypace.llll-ll.com'

  class MypaceCard extends HTMLElement {
    constructor() {
      super()
      this._iframe = null
      this._boundHandleMessage = this._handleMessage.bind(this)
    }

    connectedCallback() {
      const noteId = this.getAttribute('note')
      const isLatest = this.hasAttribute('latest')
      const pubkey = this.getAttribute('pubkey')
      const theme = this.getAttribute('theme') || 'light'

      if (!noteId && !isLatest) {
        this.innerHTML = '<p style="color: red;">Error: Specify "note" attribute or "latest" attribute</p>'
        return
      }

      // Default styles (can be overridden by user's style attribute)
      if (!this.style.display) this.style.display = 'block'
      if (!this.style.maxWidth) this.style.maxWidth = '500px'

      let src
      if (isLatest) {
        const params = new URLSearchParams({ theme })
        if (pubkey) params.set('pubkey', pubkey)
        src = `${MYPACE_URL}/embed/latest?${params.toString()}`
      } else {
        src = `${MYPACE_URL}/embed/${encodeURIComponent(noteId)}?theme=${encodeURIComponent(theme)}`
      }

      this._iframe = document.createElement('iframe')
      this._iframe.src = src
      this._iframe.style.cssText = 'border: none; width: 100%; min-height: 200px;'
      this._iframe.setAttribute('loading', 'lazy')
      this._iframe.setAttribute('allowtransparency', 'true')

      this.appendChild(this._iframe)

      // Listen for height updates from iframe
      window.addEventListener('message', this._boundHandleMessage)
    }

    disconnectedCallback() {
      window.removeEventListener('message', this._boundHandleMessage)
    }

    _handleMessage(event) {
      if (event.origin !== MYPACE_URL) return
      if (!event.data || event.data.type !== 'mypace-embed-height') return
      if (this._iframe) {
        this._iframe.style.height = event.data.height + 'px'
      }
    }
  }

  // Register custom element
  if (!customElements.get('mypace-card')) {
    customElements.define('mypace-card', MypaceCard)
  }
})()
