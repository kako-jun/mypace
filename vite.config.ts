import { defineConfig } from 'vite'
import honox from 'honox/vite'
import pages from '@hono/vite-cloudflare-pages'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    honox({
      client: {
        input: ['/app/client.ts']
      }
    }),
    mode === 'production' && pages(),
    tailwindcss()
  ].filter(Boolean),
  ssr: {
    external: ['ws', 'socks-proxy-agent', 'dotenv']
  }
}))
