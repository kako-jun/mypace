import { jsxRenderer } from 'hono/jsx-renderer'
import { Script } from 'honox/server'

export default jsxRenderer(({ children, title }) => {
  return (
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{title ?? 'mypace'}</title>
        <link rel="stylesheet" href="/static/style.css" />
        <Script src="/app/client.ts" async />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
})
