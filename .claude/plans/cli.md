# mypace CLI

## Overview

Command-line tool for posting to MyPace.
Similar to Qiita CLI / Zenn CLI.

## Install

```bash
npm install -g @mypace/cli
# or
pnpm add -g @mypace/cli
```

## Setup

```bash
mypace login
# Opens browser for NIP-07 auth
# Or enter nsec directly
```

## Commands

```bash
# Post from file
mypace post ./article.md

# Post from stdin
echo "Hello World" | mypace post -

# Preview (dry run)
mypace post ./article.md --dry-run

# Save as draft
mypace draft ./article.md

# Add hashtags
mypace post ./article.md --tags "mypace,travel"

# Add location
mypace post ./article.md --location "35.0116,135.7681"
```

## Config

`~/.mypace/config.json`
```json
{
  "relays": [
    "wss://relay.damus.io",
    "wss://relay.nostr.band"
  ],
  "defaultTags": ["mypace"],
  "privateKey": "nsec1..." // encrypted
}
```

## Frontmatter

```markdown
---
tags: [mypace, travel]
location: [35.0116, 135.7681, "Kyoto"]
stickers:
  - url: https://example.com/pop.png
    x: 85
    y: 10
    size: 20
---

# Travel Log

Content here...
```

## Structure

```
packages/
  cli/
    src/
      index.ts        # Entry point
      commands/
        post.ts       # Post command
        draft.ts      # Draft command
        login.ts      # Login command
      lib/
        nostr.ts      # Nostr signing
        config.ts     # Config management
```
