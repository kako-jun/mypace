# Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ NIP-07 Ext  │  │ PostForm    │  │ Timeline            │  │
│  │ (optional)  │  │ (→ relay)   │  │ (← API)             │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼─────────────────────┼────────────┘
          │                │                     │
          │                ▼                     │
          │    ┌─────────────────────┐           │
          │    │   Nostr Relays      │           │
          │    │ (nos.lol, etc.)     │◄──────────┤
          │    └─────────────────────┘           │
          │                                      │
          │                ▼                     ▼
          │    ┌─────────────────────────────────────────┐
          │    │        HonoX (Cloudflare Pages)         │
          │    │  ┌─────────────┐  ┌─────────────────┐   │
          │    │  │ SSR Pages   │  │ API Routes      │   │
          │    │  │ /           │  │ /api/timeline   │   │
          │    │  └─────────────┘  └────────┬────────┘   │
          │    │                            │            │
          │    │                   ┌────────▼────────┐   │
          │    │                   │ Cloudflare D1   │   │
          │    │                   │ (cache)         │   │
          │    │                   └─────────────────┘   │
          │    └─────────────────────────────────────────┘
          │
    ┌─────▼─────┐
    │ Secret Key│
    │ (local)   │
    └───────────┘
```

## Data Flow

### Post (Client → Relay)
1. User types content
2. Client JS builds Nostr event (kind:1)
3. Sign with localStorage key or NIP-07
4. WebSocket → Relay directly

### Read (Client → API → Relay)
1. Client fetches `/api/timeline`
2. API checks D1 cache (5min TTL)
3. Cache miss → fetch from relays → cache to D1
4. Return JSON

## Cloudflare Services

| Service | Purpose |
|---------|---------|
| Pages | Host HonoX app (SSR + API) |
| D1 | SQLite cache for events |

## HonoX Features Used

- **Islands Architecture**: Only interactive parts hydrate
- **File-based Routing**: `app/routes/`
- **SSR**: Server-side rendering for fast first paint
- **c.env**: Access D1 bindings
