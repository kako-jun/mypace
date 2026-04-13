# DESIGN.md

mypace — Design System

## 1. Visual Theme & Atmosphere

Playful, craft-paper social network. Folded-corner cards, octagonal buttons, sticker overlays, and outlined author names create a scrapbook feel — like a handmade bulletin board where everyone's posts are unique collages. The UI has personality: avatars animate on long hover cycles, post forms slide up from the bottom, and a rainbow gradient pulses through highlighted text. Light and dark themes with custom gradient overlays.

Inspirations: scrapbooking, bulletin boards, LINE stickers, Japanese SNS aesthetics.

## 2. Color Palette & Roles

CSS custom properties with `color-mix()` derivation. Themes switch 5 base values; everything else auto-derives.

### Light Theme

| Variable        | Value     | Usage                     |
| --------------- | --------- | ------------------------- |
| `--bg`          | `#f8f8f8` | Page background           |
| `--text`        | `#2d2d2d` | Primary text              |
| `--accent`      | `#5588aa` | Links, active states      |
| `--highlight`   | `#e8b700` | Gold emphasis, stars      |
| `--error`       | `#cc3333` | Error/delete states       |

### Dark Theme

| Variable        | Value     | Usage                     |
| --------------- | --------- | ------------------------- |
| `--bg`          | `#282828` | Page background           |
| `--text`        | `#e4e4e4` | Primary text              |
| `--accent`      | `#6699bb` | Links, active states      |
| `--highlight`   | `#f0c020` | Gold emphasis             |
| `--error`       | `#cc3333` | Error/delete              |

### Derived Colors (via color-mix)

| Variable          | Derivation                     | Usage                 |
| ----------------- | ------------------------------ | --------------------- |
| `--surface`       | `bg 92% + text 8%`            | Card backgrounds      |
| `--surface-alt`   | `bg 86% + text 14%`           | Alternate surfaces    |
| `--border`        | `text 15% + bg 85%`           | Standard borders      |
| `--border-strong` | `text 25% + bg 75%`           | Input/toggle borders  |
| `--text-muted`    | `text 65% + bg 35%`           | Secondary text        |

### Action Colors (Fixed)

| Color   | Hex       | Usage              |
| ------- | --------- | ------------------ |
| Reply   | `#3498db` | Reply button/icon  |
| Repost  | `#2ecc71` | Repost indicator   |
| Delete  | `#e53935` | Delete action      |

## 3. Typography Rules

### Font Families

| Context   | Family                           |
| --------- | -------------------------------- |
| UI/body   | `"M PLUS Rounded 1c", sans-serif` |
| Content   | `"BIZ UDGothic", monospace`      |

### Type Scale

| Element       | Size    | Weight | Notes                        |
| ------------- | ------- | ------ | ---------------------------- |
| Author name   | 1.2rem  | 900    | Outlined text, tracking 0.05em |
| Body          | 1rem    | 400    | Line height 1.6              |
| Markdown      | —       | —      | Line height 1.7              |
| Code          | —       | —      | Line height 1.5              |
| Long preview  | —       | —      | Line height 1.9              |
| Small/meta    | 0.85rem | 400    |                              |
| Button        | —       | 600    |                              |

### Text Effects

- Author names: `-webkit-text-stroke: 0.5px` for outlined appearance
- Rainbow text: `@keyframes rainbow` cycling hue-rotate over 3s
- Text shadows: `#555` (light) / `#222` (dark)

## 4. Component Stylings

### Octagonal Buttons

Signature design — corners clipped at ~8px via `clip-path`.

- Background: `var(--accent)`
- Color: `#fff`
- Padding: variable by size (sm: `4px 10px`, md: `6px 14px`)
- Border radius: `0` (clip-path handles shape)
- Hover: `scale(1.05)`, brightness +10%
- Active: `scale(0.97)`

### Post Cards (Folded Corner)

- Background: `var(--surface)`
- Border: `1px solid var(--border)`
- Border radius: `8px`
- Hover: `drop-shadow(10px 10px 0 #000)` (comic-book shadow)
- Folded corner: CSS triangle via `::after` pseudo-element

### Sticker System (4 Layers)

| Z-Index | Layer   | Content              |
| ------- | ------- | -------------------- |
| 0       | Back    | Behind-content stickers |
| 1       | Content | Post text/media      |
| 5       | Preview | Sticker placement preview |
| 10      | Front   | Over-content stickers |

Stickers: draggable + rotatable + resizable via touch handles.
- Drag handle: entire sticker
- Resize: `14px` corner handle
- Rotate: `16px` handle
- Delete: `20px` button

### Post Form

- Position: fixed bottom, slides up
- Width: `560px`
- Min height: `18rem`
- Minimized: `56px` square (bottom-right)
- Z-index: `1050`
- Border radius: `8px` (top corners)

### Modals

- Overlay: `rgba(0,0,0,0.5)`
- Content: `var(--bg)`, `padding: 2rem`, `border-radius: 8px`
- Max height: `70vh` (90vh for location picker)
- Z-index: `1000`
- Slide-up animation from bottom

### Avatars

- Sizes: `24px`, `64px`, `96px`
- Border radius: `50%`
- Animations: 30s cycles (pulse/bounce/wink) on long hover
- Border: `2px solid var(--border)`

### Toggle Switch

- Track: `44px × 24px`
- Thumb: `16px`, white
- Active: `var(--accent)` background
- Transition: `0.3s`

### Inputs

- Padding: `0.4rem 0.6rem`
- Border: `1px solid var(--border-strong)`
- Border radius: `6px`
- Focus: `border-color: var(--accent)`

## 5. Layout Principles

### Container

- Width: `100%`
- Top padding: `3rem` (6rem in long-mode editor)
- No max-width constraint — content fills viewport

### Spacing Scale

| Value   | Usage                |
| ------- | -------------------- |
| 0.25rem | Tight gaps           |
| 0.5rem  | Standard gaps        |
| 0.75rem | Card gaps            |
| 1rem    | Section padding      |
| 1.5rem  | Large spacing        |
| 2rem    | Modal padding        |
| 3rem    | Top padding          |

### Header

- Position: fixed top
- Z-index: `100` (logo: `101`)

### Grid Layouts

- Post feed: single column, flex
- Location picker: grid with auto-fit columns
- Sticker picker: flex wrap

## 6. Depth & Elevation

### Z-Index Stack

| Layer          | Value |
| -------------- | ----- |
| Back stickers  | 0     |
| Content        | 1     |
| Preview        | 5     |
| Front stickers | 10    |
| Header         | 100   |
| Logo           | 101   |
| Modals         | 1000  |
| Post form      | 1050  |
| Loading        | 9999  |

### Shadows

- Stickers: `drop-shadow(1px 1px 2px rgba(0,0,0,0.2))`
- Post card hover: `drop-shadow(10px 10px 0 #000)` (hard, comic-style)
- Glass effect on custom theme overlays: `backdrop-filter: blur(8px)`

### Border Radius

| Component   | Radius |
| ----------- | ------ |
| Cards       | `8px`  |
| Modals      | `8px`  |
| Inputs      | `6px`  |
| Avatars     | `50%`  |
| Buttons     | `0` (clip-path octagon) |

## 7. Do's and Don'ts

### Do

- Use `color-mix()` for all derived colors — themes auto-adapt
- Apply clip-path octagonal shape on primary buttons
- Include folded-corner effect on post cards
- Support 4-layer sticker z-ordering (back/content/preview/front)
- Use `M PLUS Rounded 1c` for UI and `BIZ UDGothic` for content
- Apply comic-style hard drop-shadow on card hover
- Animate avatars on hover (30s cycles)
- Use View Transition API for page navigation (`fade-in/fade-out 0.3s`)

### Don't

- Hardcode colors — always use CSS variables
- Use standard rounded buttons — octagonal clip-path is the brand
- Remove the folded-corner card effect
- Apply stickers outside the z-index hierarchy
- Use sans-serif fonts outside the defined font stack
- Add heavy transitions to post cards — the hard shadow is deliberate

### Animations

| Animation      | Duration | Timing                                    | Usage            |
| -------------- | -------- | ----------------------------------------- | ---------------- |
| Card appear    | 0.3s     | ease, staggered                           | Feed load        |
| Sticker appear | 0.4s     | `cubic-bezier(0.68, -0.55, 0.265, 1.55)` | Bounce in        |
| Avatar pulse   | 30s      | ease                                      | Idle animation   |
| Logo star spin | 42s/2.5s | linear / initial spin-up                  | Logo decoration  |
| Rainbow text   | 3s       | hue-rotate cycle                          | Highlighted text |
| View transition | 0.3s    | fade-in/out                               | Page navigation  |

## 8. Responsive Behavior

### Breakpoints

| Name    | Value  | Changes                             |
| ------- | ------ | ----------------------------------- |
| Mobile  | < 480px | Column layouts, compact spacing    |
| Tablet  | 768px  | Row layouts, landscape adaptations  |

Also: `aspect-ratio: 1/1` (landscape detection for tablet game views).

### Touch Adaptations

- Sticker handles: `20-24px` (vs `14-16px` desktop)
- Modal heights adjust for mobile keyboards
- Post form: full-width on mobile, `560px` on desktop

## 9. Agent Prompt Guide

### CSS Variable Quick Reference

```
Light:                          Dark:
--bg:        #f8f8f8            --bg:        #282828
--text:      #2d2d2d            --text:      #e4e4e4
--accent:    #5588aa            --accent:    #6699bb
--highlight: #e8b700            --highlight: #f0c020
--error:     #cc3333            --error:     #cc3333

Derived (both themes):
--surface:      bg 92% + text 8%
--surface-alt:  bg 86% + text 14%
--border:       text 15% + bg 85%
--text-muted:   text 65% + bg 35%
```

### When generating UI for this project

- Octagonal buttons via clip-path. This is the signature UI element
- Folded-corner post cards. Cards must have the paper fold effect
- `M PLUS Rounded 1c` for UI, `BIZ UDGothic` for user content
- `color-mix()` color system — change 5 base vars, everything follows
- 4-layer sticker system with strict z-ordering
- Post form slides up from bottom, minimizable to 56px square
- Action colors are fixed: reply blue (#3498db), repost green (#2ecc71), delete red (#e53935)
- Hard comic drop-shadow on card hover (`10px 10px 0 #000`)
- Glass backdrop blur for custom theme overlays
- View Transition API for smooth page navigation

### Color Emotion Reference

- **Accent blue (#5588aa):** Calm interaction, trustworthy
- **Gold (#e8b700):** Achievement, highlight, premium
- **Reply blue (#3498db):** Conversation, connection
- **Repost green (#2ecc71):** Sharing, amplification
- **Delete red (#e53935):** Caution, irreversible
