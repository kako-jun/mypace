# Deployment

## Prerequisites

1. Cloudflare account
2. Wrangler CLI logged in: `npx wrangler login`

## Setup D1 Database

```bash
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
npm run build
npm run deploy
```

## Local Preview

```bash
# With D1 local database
npx wrangler d1 execute mypace-db --local --file=./schema.sql
npm run preview
```

## Environment

No environment variables required. All configuration is in `wrangler.toml`.

## Troubleshooting

### D1 not working
- Check `database_id` in wrangler.toml matches your D1 database
- Ensure schema is applied: `npx wrangler d1 execute mypace-db --file=./schema.sql`

### WebSocket issues
- Relay connections happen client-side, not through Workers
- Check browser console for connection errors
