// OGP metadata type
export interface OGPMetadata {
  title: string
  description: string
  url: string
  image?: string
  type?: 'website' | 'article' | 'profile'
}

// Base HTML template (copy from index.html but with dynamic OGP tags)
export function generateHTML(ogp: OGPMetadata): string {
  const { title, description, url, image = 'https://mypace.llll-ll.com/static/ogp.webp', type = 'website' } = ogp

  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="view-transition" content="same-origin" />
    <meta name="theme-color" content="#FFCB3D" />

    <!-- SEO -->
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="keywords" content="SNS,Nostr,分散型,ソーシャルメディア,ブログ,ミディアムレアSNS" />
    <meta name="author" content="MY PACE" />
    <link rel="canonical" href="${escapeHtml(url)}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="${type}" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:site_name" content="MY PACE" />
    <meta property="og:locale" content="ja_JP" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:url" content="${escapeHtml(url)}" />
    <meta name="twitter:title" content="${escapeHtml(title)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />

    <!-- Additional SEO -->
    <meta name="robots" content="index, follow" />
    <meta name="googlebot" content="index, follow" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=BIZ+UDGothic&family=M+PLUS+Rounded+1c:wght@400;700;900&display=swap"
      rel="stylesheet"
    />
    <link rel="icon" type="image/webp" href="/favicon.webp" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.webp" />
    <link rel="manifest" href="/manifest.webmanifest" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
}

// HTML escape utility
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return text.replace(/[&<>"']/g, (char) => map[char] || char)
}

// Truncate text to specified length
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

// Extract text from Nostr content (remove URLs, mentions, etc.)
export function extractPlainText(content: string): string {
  return content
    .replace(/nostr:(npub|note|nprofile|nevent)[a-z0-9]+/gi, '') // Remove Nostr references
    .replace(/https?:\/\/\S+/gi, '') // Remove URLs
    .replace(/#\S+/g, '') // Remove hashtags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
}
