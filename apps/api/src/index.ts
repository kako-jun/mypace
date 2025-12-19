import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Bindings } from './types'

// Routes
import timeline from './routes/timeline'
import events from './routes/events'
import profiles from './routes/profiles'
import reactions from './routes/reactions'
import replies from './routes/replies'
import reposts from './routes/reposts'
import userEvents from './routes/user-events'
import publish from './routes/publish'
import ogp from './routes/ogp'
import tweet from './routes/tweet'
import wikidata from './routes/wikidata'
import superMention from './routes/super-mention'
import wellKnown from './routes/well-known'

const app = new Hono<{ Bindings: Bindings }>()

// CORS - すべてのオリジンを許可
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
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

// Well-known
app.route('/.well-known', wellKnown)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
