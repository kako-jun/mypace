# Super Mention

> **"Personification of all things"** - Say "Thanks for the great story" to a manga, "Always appreciate you" to oxygen.

## Overview

`@@` syntax to comment on anything in the world.

Regular mention `@user` is for people. Super mention `@@` is for everything.

```
@@Kaiji

The scene with Miyamoto was amazing

#mypace
```

## Syntax

```
@@target
```

- Starts with `@@` (double at-mark)
- UTF-8 string (Japanese OK)
- Spaces converted to underscores automatically
- Can include: letters, numbers, CJK characters, `-`, `_`, `.`, `:`, `?`, `=`, `&`, `%`, `#`, `,`, `/`

## Nostr Tag Conversion

Super mentions are converted to `t` tags with `/` prefix.

**Post content:**
```
@@Kaiji

Volume 20 was amazing
```

**Nostr event:**
```json
{
  "kind": 1,
  "content": "@@Kaiji\n\nVolume 20 was amazing",
  "tags": [
    ["t", "mypace"],
    ["t", "/Kaiji"]
  ]
}
```

- Uses `t` tag (standard Nostr spec)
- Other clients display as hashtag

## Display

Super mentions are highlighted in post cards.

```
┌────────────────────────────────────┐
│ @username · 2 hours ago            │
│                                    │
│ @@Kaiji (Q12345678)                │  ← Highlighted + Q badge
│                                    │
│ Volume 20 was amazing              │
│                                    │
│ ★★★                                │
└────────────────────────────────────┘
```

- `@@` portion shown in bold yellow
- Click to filter by this super mention
- Q badge shown for confirmed Wikidata mappings

### Q Badge Wikipedia Link

Click the Q badge to open the corresponding Wikipedia page:

```
https://www.wikidata.org/wiki/Special:GoToLinkedPage/jawiki/{Q-number}
```

## Suggest UI

Click the `@@` button in editor or type `@@` to open the popup:

```
┌─────────────────────────────────────────────────────────┐
│ Super Mention                                       [×] │
├─────────────────────────────────────────────────────────┤
│ @@ [Search...]                                          │
├─────────────────────────────────────────────────────────┤
│ [Check] Kaiji [Q12345678] Japanese manga                │ ← Confirmed
│ [Search] Gambling Apocalypse Kaiji [Q99999] Manga       │ ← Wikidata
│ [PenLine] Kaiji  Create new                             │ ← Custom
└─────────────────────────────────────────────────────────┘
```

- Popup modal (not inline dropdown)
- Search is partial match
- Arrow keys to navigate, Enter/Tab to select, Escape to close
- Empty search shows recent history

### Suggest Icons

| Icon | Meaning |
|------|---------|
| Check | History with confirmed Q number |
| Pin | History without Q number |
| Search | Wikidata search result |
| PenLine | Create new (custom path) |

### Space Handling

Spaces in paths are automatically converted to underscores:

- Input: `@@My Favorite Manga`
- Stored: `@@My_Favorite_Manga`

### Q Number Correction

If wrong Q number is linked:

1. Enter same path (e.g., `@@Kaiji`)
2. Both history and Wikidata results appear
3. Select correct Wikidata result
4. Q number is updated

## Wikidata Mapping

Super mentions are linked to Wikidata Q numbers.

```sql
CREATE TABLE super_mention_paths (
  path TEXT PRIMARY KEY,              -- "/Kaiji"
  wikidata_id TEXT,                   -- "Q123456789" (nullable)
  wikidata_label TEXT,                -- "Gambling Apocalypse Kaiji"
  wikidata_description TEXT,          -- "Japanese manga series"
  use_count INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

**API Endpoints:**

- `GET /api/wikidata/search?q=Kaiji&lang=ja` - Wikidata search
- `GET /api/super-mention/suggest?prefix=Kaiji` - Get suggestions
- `POST /api/super-mention/paths` - Save path (auto on use)

## URL Reference

URLs can be mentioned with `@@`:

```
@@github.com/nostr-protocol/nips
```

- Domain format (`example.com` or `example.com/path`) recognized as URL
- Click opens as external link with `https://`
- No Wikidata search for URLs

**Example:**
```
@@github.com/nostr-protocol/nips

This repo is well organized
```

## Future

### Search

Search posts about specific targets:

```
/posts?ref=/Kaiji
```

### Q Number Normalization

Unify variant spellings:
- `@@Kaiji` → normalized by Q number
- `@@GamblingApocalypseKaiji` → same Q number

## Design Philosophy

### Why `@@`

- `@` is mention for people
- `@@` is "super" mention (for everything)
- Flat management with Wikidata Q numbers

### Difference from Hatena Bookmark

- Hatena: Only things with URLs
- mypace: Everything (with or without URL)

### Tag Proliferation Solution

- Suggestions guide convergence
- Popular paths ranked higher
- Q numbers identify same target
