# Deployment

## Prerequisites

1. Cloudflare account
2. Wrangler CLI logged in: `npx wrangler login`

## Setup D1 Database

```bash
cd apps/api

# Create database
npx wrangler d1 create mypace-db

# Update wrangler.toml with returned database_id
# [[d1_databases]]
# binding = "DB"
# database_name = "mypace-db"
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"

# Apply schema
npx wrangler d1 execute mypace-db --file=./schema.sql
```

## Deploy

```bash
# Deploy both web and api
pnpm deploy

# Or deploy individually
pnpm deploy:web   # apps/web → Cloudflare Pages
pnpm deploy:api   # apps/api → Cloudflare Workers
```

## Local Preview

```bash
# API with local D1
cd apps/api
npx wrangler d1 execute mypace-db --local --file=./schema.sql
pnpm dev

# Frontend
cd apps/web
pnpm dev
```

## Environment Variables

### API (apps/api/wrangler.toml)

```toml
[vars]
# Optional: SOCKS5 proxy for relay connections
SOCKS5_PROXY = "socks5://your-proxy:1080"
```

### Frontend (apps/web)

Production environment variables are set in Cloudflare Pages dashboard:

- `VITE_API_URL`: API endpoint URL (e.g., `https://mypace-api.your-subdomain.workers.dev`)

## Architecture

```
┌─────────────────────────────────────────┐
│           Cloudflare Pages              │
│  apps/web → Static SPA              │
│  https://mypace.llll-ll.com             │
└────────────────────┬────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────┐
│          Cloudflare Workers             │
│  apps/api → Hono API                │
│  https://mypace-api.workers.dev         │
│                                         │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │ D1 Database │  │ SOCKS5 Proxy     │  │
│  │ (cache)     │  │ (optional)       │  │
│  └─────────────┘  └────────┬─────────┘  │
└────────────────────────────┼────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Nostr Relays   │
                    └─────────────────┘
```

## Troubleshooting

### D1 not working

- Check `database_id` in wrangler.toml matches your D1 database
- Ensure schema is applied:
  ```bash
  cd apps/api
  npx wrangler d1 execute mypace-db --file=./schema.sql
  ```

### CORS errors

- Check CORS configuration in `apps/api/src/index.ts`
- Ensure your frontend origin is in the allowed origins list

### API connection issues

- Verify `VITE_API_URL` is set correctly
- Check Cloudflare Workers logs: `npx wrangler tail`

### SOCKS5 proxy not working

- Verify proxy is running and accessible from Workers
- Check `SOCKS5_PROXY` format: `socks5://host:port`
