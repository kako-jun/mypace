import { defineConfig } from 'vite'
import honox from 'honox/vite'
import pages from '@hono/vite-cloudflare-pages'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    honox({
      client: {
        input: ['/app/client.ts']
      }
    }),
    pages(),
    tailwindcss()
  ]
})
