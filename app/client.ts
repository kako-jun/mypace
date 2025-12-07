import { createClient } from 'honox/client'
import { getString } from './lib/utils/storage'

// Initialize theme immediately to prevent flash
const storedAppTheme = getString('mypace_app_theme')
if (storedAppTheme) {
  document.documentElement.setAttribute('data-theme', storedAppTheme)
}

createClient()

// Enable View Transitions for SPA-like navigation
if ('startViewTransition' in document) {
  document.addEventListener('click', (e) => {
    const link = (e.target as HTMLElement).closest('a')
    if (!link || link.target || link.origin !== location.origin) return

    e.preventDefault()
    const href = link.href

    ;(document as any).startViewTransition(async () => {
      const res = await fetch(href)
      const html = await res.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      document.title = doc.title
      document.body.innerHTML = doc.body.innerHTML
      history.pushState({}, '', href)
    })
  })

  window.addEventListener('popstate', () => {
    ;(document as any).startViewTransition(async () => {
      const res = await fetch(location.href)
      const html = await res.text()
      const parser = new DOMParser()
      const doc = parser.parseFromString(html, 'text/html')

      document.title = doc.title
      document.body.innerHTML = doc.body.innerHTML
    })
  })
}
