# Development

## Directory Structure

```
mypace/
├── app/
│   ├── routes/           # File-based routing
│   │   ├── _renderer.tsx # HTML template
│   │   ├── index.tsx     # / page
│   │   └── api/
│   │       └── timeline.ts
│   ├── islands/          # Client-hydrated components
│   │   ├── PostForm.tsx
│   │   ├── Timeline.tsx
│   │   └── Settings.tsx
│   ├── components/       # Server-only components
│   ├── lib/
│   │   ├── nostr/        # Nostr utilities
│   │   │   ├── keys.ts
│   │   │   ├── events.ts
│   │   │   └── relay.ts
│   │   └── db/
│   │       └── cache.ts  # D1 cache layer
│   ├── client.ts         # Client entry
│   ├── server.ts         # Server entry
│   └── global.d.ts       # Type definitions
├── public/
│   └── static/
│       └── style.css
├── docs/
├── schema.sql            # D1 schema
├── wrangler.toml         # Cloudflare config
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Adding New Pages

Create `app/routes/pagename.tsx`:
```typescript
import { createRoute } from 'honox/factory'

export default createRoute((c) => {
  return c.render(<div>Content</div>)
})
```

## Adding New Islands

Create `app/islands/Name.tsx`:
```typescript
import { useState } from 'hono/jsx'

export default function Name() {
  const [state, setState] = useState('')
  return <div>...</div>
}
```

Use in route:
```typescript
import Name from '../islands/Name'
// <Name /> will hydrate on client
```

## Adding API Routes

Create `app/routes/api/endpoint.ts`:
```typescript
import { createRoute } from 'honox/factory'

export default createRoute(async (c) => {
  const db = c.env?.DB
  return c.json({ data: 'value' })
})
```

## TypeScript

- JSX: `hono/jsx`
- Types: `@cloudflare/workers-types`
- Path alias: `~/` → `./app/`
