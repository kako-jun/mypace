import type { D1Database } from '@cloudflare/workers-types'

declare module 'hono' {
  interface Env {
    Bindings: {
      DB: D1Database
    }
  }
}
