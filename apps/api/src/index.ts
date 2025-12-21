import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'
import {
  timeline,
  events,
  profiles,
  reactions,
  replies,
  reposts,
  userEvents,
  publish,
  ogp,
  tweet,
  wikidata,
  superMention,
  sticker,
  pins,
  wellKnown,
  raw,
  serial,
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

// API Routes
app.route('/api/timeline', timeline)
app.route('/api/events', events)
app.route('/api/profiles', profiles)
app.route('/api/reactions', reactions)
app.route('/api/replies', replies)
app.route('/api/reposts', reposts)
app.route('/api/user', userEvents)
app.route('/api/publish', publish)
app.route('/api/ogp', ogp)
app.route('/api/tweet', tweet)
app.route('/api/wikidata', wikidata)
app.route('/api/super-mention', superMention)
app.route('/api/sticker', sticker)
app.route('/api/pins', pins)
app.route('/api/serial', serial)

// Well-known
app.route('/.well-known', wellKnown)

// Raw content
app.route('/raw', raw)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
