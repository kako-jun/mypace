import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'
import {
  events,
  profiles,
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
  stellaBalance,
  supernovas,
  magazine,
  wordrot,
  sitemap,
  reporter,
} from './routes'

const app = new Hono<{ Bindings: Bindings }>()

// CORS - 許可するオリジンを制限
const ALLOWED_ORIGINS = [
  'https://mypace.llll-ll.com',
  'https://www.mypace.llll-ll.com',
  'http://localhost:5173', // dev server
  'http://localhost:4173', // preview server
]

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return 'https://mypace.llll-ll.com' // server-to-server or same-origin
      return ALLOWED_ORIGINS.includes(origin) ? origin : null
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)

// エラーハンドラ - アプリ内エラーにもCORSヘッダーを付与
app.onError((err, c) => {
  console.error('API Error:', err)
  const origin = c.req.header('Origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://mypace.llll-ll.com'
  return c.json({ error: err.message || 'Internal Server Error' }, 500, {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  })
})

// API Routes
app.route('/api/events', events)
app.route('/api/profiles', profiles)
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
app.route('/api/stella-balance', stellaBalance)
app.route('/api/supernovas', supernovas)
app.route('/api/magazine', magazine)
app.route('/api/wordrot', wordrot)
app.route('/api/sitemap', sitemap)
app.route('/api/npc/reporter', reporter)

// Well-known
app.route('/.well-known', wellKnown)

// Raw content
app.route('/raw', raw)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
