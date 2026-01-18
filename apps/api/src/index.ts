import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'
import {
  events,
  userCount,
  publish,
  ogp,
  tweet,
  wikidata,
  superMention,
  sticker,
  pins,
  uploads,
  wellKnown,
  raw,
  serial,
  views,
  notifications,
  push,
} from './routes'

const app = new Hono<{ Bindings: Bindings }>()

// CORS - すべてのオリジンを許可
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
)

// エラーハンドラ - アプリ内エラーにもCORSヘッダーを付与
app.onError((err, c) => {
  console.error('API Error:', err)
  return c.json({ error: err.message || 'Internal Server Error' }, 500, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
})

// API Routes
app.route('/api/events', events)
app.route('/api/user', userCount)
app.route('/api/publish', publish)
app.route('/api/ogp', ogp)
app.route('/api/tweet', tweet)
app.route('/api/wikidata', wikidata)
app.route('/api/super-mention', superMention)
app.route('/api/sticker', sticker)
app.route('/api/pins', pins)
app.route('/api/uploads', uploads)
app.route('/api/serial', serial)
app.route('/api/views', views)
app.route('/api/notifications', notifications)
app.route('/api/push', push)

// Well-known
app.route('/.well-known', wellKnown)

// Raw content
app.route('/raw', raw)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
