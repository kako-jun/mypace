import { jsxRenderer } from 'hono/jsx-renderer'
import { Script } from 'honox/server'
import { APP_TITLE } from '../lib/nostr/events'

export default jsxRenderer(({ children, title }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="view-transition" content="same-origin" />
        <meta name="theme-color" content="#f8f8f8" />
        <title>{title ?? APP_TITLE}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@400;700;900&display=swap" rel="stylesheet" />
        <link rel="icon" type="image/webp" href="/favicon.webp" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.webp" />
        <link rel="stylesheet" href="/app/styles/tailwind.css" />
        <Script src="/app/client.ts" async />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
})
