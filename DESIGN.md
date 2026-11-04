# Design

This file describes the visual system of the Camioane App admin frontend as it is built. When the code changes a token, a size or a pattern listed here, update this file in the same commit.

The system follows one idea: the admin screens are tools people work in every day. Colour belongs to the data and the one action that matters. The chrome stays quiet, and the product's own things (its cars, routes, clients, credits) carry the screen.

## Sources of truth

| What | File |
| --- | --- |
| Global tokens, base element styles, focus ring | `frontend/src/index.css` |
| Shell: sidebar, sheet, mobile header and navigation | `frontend/src/components/AppShell.css`, `AppShell.tsx` |
| Buttons, forms, the Users table, page headings | `frontend/src/App.css` |
| Dashboard tokens and the data patterns (KPIs, timeline, rows, pills, tabs, tables, dialog) | `frontend/src/pages/DashboardPage/DashboardPage.css` |
| Fonts | `frontend/src/main.tsx` (`@fontsource` imports) |
| Number, time and date formatting | `frontend/src/pages/DashboardPage/dashboardData.ts` |
| Brand artwork | `assets/app-icon/` |

## Principles

- **Colour goes on data, status and the one primary action.** The sidebar, headers and panels stay neutral. A screen shows little colour, and almost all of it is on data.
- **Figures are type, not tiles.** Headline figures share one card split by dividers. Don't give them icons, tinted tiles or sparklines.
- **Surfaces are flat.** A 1px line or one step of tone separates them. Only things that float (today, the dialog) get a shadow.
- **Use the trade's words.** Write car-hours, credits, slots, creatives, routes, plates and drivers, not "items", "records" or "status".
- **Data is honest:**
  - Compute every total from the rows it sums. Never type a total by hand.
  - A fact shown in two places is one value in the data.
  - Colour means good or bad, never just up or down.
  - Print a real zero. Show a missing value as a grey dash (—).
  - Every relative figure names its baseline: "35.6 of 37.0 h", "96% of the hours due by 14:30".
- **Each screen answers one question first.** Its largest block answers it, and its most common job is one click away.

## Brand

- **Name:** Camioane App.
- **Mark:** a car carrying a rooftop LED screen. `BrandMark` in `AppShell.tsx` redraws `assets/app-icon/icon.png` as a 28px inline SVG. The wheels are outlined in `--frame` so they separate from the body.
- **Colours:**

| Colour | Hex | Use | Contrast on white |
| --- | --- | --- | --- |
| Navy | `#12263A` | The mark, primary buttons (`--primary`), ink on pale data | 15.4:1 |
| Cyan | `#00C9E8` | The mark only | 2.0:1: never use it for text or thin marks |
| Data cyan | `#007C92` | Data series, the now-line, the selected tab | 4.9:1: holds white labels |

## Tokens

### Global (`index.css`, on `:root`)

| Token | Value | Role |
| --- | --- | --- |
| `--surface` | `#fff` | Sheet, panels, inputs |
| `--text` | `#202020` | Primary ink (16.3:1 on white) |
| `--muted` | `#646464` | Labels, meta, units (5.9:1 on white, 5.5:1 on `--frame`) |
| `--border` | `#e5e5e5` | Panel and sheet edges, table header rules |
| `--control-border` | `#b8b8b8` | Inputs, secondary buttons, dashed empty states |
| `--hover` | `#f5f5f5` | Button hover, disabled fill |
| `--frame` | `#f3f6f8` | Shell ground: one low-chroma step of the navy |
| `--primary` | `#12263a` | Primary button fill |
| `--primary-hover` | `#213d58` | Primary button hover |
| `--mono` | IBM Plex Mono stack | Plates and IDs only |
| `--danger` | `#b42318` | Form errors, destructive text buttons |
| `--focus` | `#245bba` | Focus ring |
| `--navigation-backdrop` | `rgb(32 32 32 / 35%)` | Dialog and mobile-navigation backdrop |

### Dashboard (`DashboardPage.css`, on `.dashboard`)

These tokens are scoped to the dashboard until a second page needs them. Move them to `index.css` then.

| Token | Value | Role |
| --- | --- | --- |
| `--data` | `#007c92` | Played bars, now-line, selected tab underline |
| `--data-pale` | `#ddf5fa` | Scheduled bars (navy ink on it, 13.6:1) |
| `--data-ink` | `#12263a` | Labels on pale data |
| `--negative` | `#c4242a` | Bad news on data: undelivered content, shortfalls, failed checks (5.8:1) |
| `--positive` | `#247b50` | Good news, if any (5.2:1) |
| `--pill-positive-bg` / `-ink` | `#dcfae5` / `#04250e` | "Ready to confirm" |
| `--pill-negative-bg` / `-ink` | `#ffedea` / `#831c1e` | "Balance short", "Not enough cars" |
| `--pill-warning-bg` / `-ink` | `#fffbeb` / `#92400e` | "Creative pending" |
| `--pill-neutral-bg` | `#eef1f3` | Neutral states such as "Retry queued" |
| `--rule` | `#eef1f3` | Row rules and timeline gridlines |
| `--gap` | `20px` | The one gap between blocks, both ways |
| `--card-pad` | `20px` (16px under 768) | Panel padding |
| `--radius-card` | `10px` | Panels and the KPI strip |

## Type

- **Faces:** IBM Plex Sans 400, 500 and 600 for everything. IBM Plex Mono 400 only for licence plates and IDs. Both are self-hosted through `@fontsource`, so there are no third-party font requests.
- **Scale:**

| Role | Size | Weight |
| --- | --- | --- |
| Page title (`h1`) | 22px on the dashboard, 24px on older pages | 600 |
| Dialog title | 20px | 600 |
| Section and panel title (`h2`) | 16px | 600 |
| KPI value | 28px (24px on a phone), tracking −0.01em | 400 |
| Body, rows, table cells, buttons | 14px | 400 / 500 |
| Meta lines, KPI labels, notes | 13px | 400 / 500 |
| Small: axis ticks, captions, pills, stamps | 12px | 400 / 500 |

- Nothing goes below 12px.
- Every number uses `font-variant-numeric: tabular-nums` (the `.num` class).
- Use sentence case everywhere: no uppercase or letter-spaced labels.
- Units are a grey suffix inside the same element, for example `78.0` + `<span class="unit"> of 154.0</span>`.

## Layout and shell

- **Frame:** a 232px sidebar on `--frame` and a white sheet. The sheet is inset 8px from the top, right and bottom, with a 16px radius, a 1px `--border` edge and no shadow. The sidebar's active link is a neutral `--border` pill with a 600 label, never a brand colour.
- **Page width:** pages read in a 760px column (`.app-content`). A wide page opts out by matching its root class, as the dashboard does:
  ```css
  .app-content:has(> .dashboard) { max-width: none; }
  .app-main:has(.dashboard) { padding: 24px; }
  ```
- **Dashboard grid at 1440px:** the sheet is 1200px. Minus 2px of edges and 2 × 24px of padding, that leaves 1150px, split as 746 + 20 + 384 (`minmax(0, 1fr) 384px`, one 20px gap). Both columns end on one line: the last block in each fills the remaining height, with its content top-aligned.
- **Breakpoints (viewport):**

| Width | Change |
| --- | --- |
| ≤ 1279px | The rail stacks under the main column. Blocks that carry an action move up (attention before the timeline). |
| ≤ 1023px | The KPI strip becomes a 2 × 2 grid. |
| ≤ 767px | The sidebar folds into a mobile header with a navigation dialog. The page padding becomes 20px 16px. Touch targets become 44px. |
| ≤ 600px | Users page: the form becomes one column and the table becomes stacked rows. |

- **Container queries** (a block adapts to its own width, not the window's):

| Container | Width | Change |
| --- | --- | --- |
| `.timeline-frame` | ≤ 640px | The day scrolls sideways inside its frame (min 680px). Plates and the axis corner stay pinned, the route becomes a subheader, and the frame opens two hours before now. |
| `.routes-panel` | ≤ 720px | Each route becomes two lines: the route and its booked hours, then the other figures with their labels. |

- The page itself never scrolls sideways.

## Surfaces and radii

- **Panel** (`.panel`): 1px `--border`, `--radius-card`, `--card-pad`, `--surface`. Its heading sits inside (`.panel-header`). In the right rail the heading sits outside, 8px above (`.rail-heading`).
- **Radius scale:**

| Radius | Used on |
| --- | --- |
| 16px | Sheet |
| 12px | Dialog |
| 10px | Panels, KPI strip |
| 8px | Inner boxes: review checks, empty state, Users form |
| 6px | Buttons, inputs, sidebar links, sample-data notice |
| 4px | Pills, timeline bars |

- **Shadow:** only the dialog, `0 16px 48px rgb(18 38 58 / 18%)`. Resting surfaces have none.

## Components

### Buttons (`App.css`, `DashboardPage.css`)

| Kind | Class | Look | Use |
| --- | --- | --- | --- |
| Primary | `.primary-button` | Navy fill, white label | The screen's one main action: "Review next request", "Confirm and debit …". One per screen. |
| Secondary | `button` | White, 1px `--control-border` | Other actions ("Request changes", "Retry") |
| Ghost | `.ghost-button` | Secondary at 32px, 13px | Row actions in dense lists ("Review", "Approve") |
| Text | `.text-button` | No border or fill | Lesser actions; add `.danger` for "Reject" and "Decline" |
| Icon | `.icon-button` | 40px, 20px outline icon, `aria-label` required | Close |

- Controls are 44px tall by default and 32px in dense dashboard rows. On a phone everything is 44px.
- A disabled button names its reason in visible text tied with `aria-describedby`.

### Pills (`.pill .pill-positive|negative|warning|neutral`)

- 20px tall with a 4px radius and 12px/500 text: a pale fill with dark ink of the same hue.
- Use at most one pill per row, beside the row's name. A pill never squeezes (`flex: none`, `nowrap`).

### Tabs (`.tabs`, `.tab`)

- Tabs are underlined: the selected one has a 2px `--data` underline over a 1px `--border` rule. The others have a grey label.
- A count follows the label only on queues that need action ("Bookings 4").
- Use the full ARIA tabs pattern: arrow keys, Home and End move between tabs.

### Lists and rows (`.row-list`, `.list-row`)

- Each row has two lines: a 14px/500 title, then a 13px grey meta line. A fixed trailing column holds the figure and the action, so every row keeps the same pitch.
- Rows are separated by 1px `--rule`, with no rule above the first.
- Rows that need several actions use `.list-row-stacked` with `.row-actions-inline` under the meta lines.
- An overview list shows 2–5 rows. It states what is waiting (the queue footer: "Oldest has waited 2 d 4 h …") instead of paginating.

### KPI strip (`.kpi-strip`)

- One card split into 3–5 cells by 1px dividers. Each cell has a 13px/500 grey label, a 28px/400 value with its unit, and a 12px note that names the baseline or window.
- Don't repeat a figure that another block on the screen already leads with.

### Tables (`.routes-table`, `.price-table`, `.users-table`)

- Headers are 12px, grey, regular weight and sentence case, with no fill band. The older Users table differs: it uses 13px/500 headers over a 1px `--border` rule.
- Rows are separated by 1px `--rule`. Don't stripe them.
- Number columns and their headers are right-aligned in tabular figures.
- The identity column (the route, the person) gets the most width and a grey subline.
- A small proportional bar under a figure is 3px and grey (`.share-track`).

### Fleet timeline (`FleetTimeline.tsx`)

- Cars run down the left, grouped by route, with the plate in mono and the driver's first name in grey. Hours run across the top.
- Gridlines are 1px `--rule` every two hours. The now-line is 2px in `--data`, with its label in its own row above the hour labels so the two never collide.
- Each booking kind has its own mark. The legend swatches use the same classes as the bars, and the legend lists only the kinds on screen:

| Kind | Class | Mark |
| --- | --- | --- |
| Played | `.seg-played` | Solid `--data`, white label |
| Scheduled | `.seg-scheduled` | `--data-pale`, navy label |
| No playback logs yet | `.seg-no-logs` | White with a 1px dashed grey outline |
| Content not delivered | `.seg-undelivered` | White with a 1.5px `--negative` outline and label: the one red, because it needs a decision |
| Maintenance | `.seg-maintenance`, `.bar-maintenance` | Grey diagonal hatch (an SVG data URI, not a gradient), label on a plate |

- A booking that spans now is split at the line, with a 2px seam between the parts.
- The label goes in the widest part, and only when that part covers at least 50 minutes.

### Dialog (`BookingReviewDialog.tsx`)

- Use a native `<dialog>` opened with `showModal()`, at most 720px wide. Esc, the close button and a backdrop click all close it, and focus returns to the opener.
- **Order:** title and subline, then the checks (pass in ink, a failed fact in `--negative`), the schedule with every date, the price table with its total, the note field, and finally the actions with the blocked reason.

### Notices and empty states

- **Sample-data notice** (`.sample-notice`): `#fffbeb` fill, 1px `#fde68a` border, 12px `#92400e` text. It is for snapshot or static data only, never a page ground.
- **Empty state** (`.empty-state`): the block keeps its frame and heading and adds one sentence in a 1px dashed `--control-border` box with an 8px radius ("No bookings waiting for confirmation.").
- **Outcome line** (`.dashboard-status`, `role="status"`): one grey sentence under the title saying what an action did ("Confirmed … 960 cr debited, 440 cr left.").

## Formatting data

Use the helpers in `dashboardData.ts`; don't format inline.

| Value | Format | Helper |
| --- | --- | --- |
| Credits | Whole number with a thousands separator and a grey "cr" suffix: `5,780 cr` | `formatCount` |
| Car-hours | Always one decimal: `78.0`, `35.6` | `formatHours` (from minutes), `formatHourValue` |
| Rates | Credits per car-hour: `45 cr/car-h`, or a bare number under a header that names the unit | — |
| Time | 24-hour clock: `14:30`; ranges with an en dash: `17:00–20:00` | `formatTime`, `formatWindow` |
| Date | en-GB, short: `Wed 4 Nov`; with the year where the day stands alone: `Wed, 4 Nov 2026` | `formatDay`, `formatLongDay` |
| Waiting time | `2 d 4 h`, `22 h 25 min` | `waitingFor` |
| Counts with nouns | Singular or plural: `1 car`, `6 dates` | `plural` |
| Missing value | A grey em dash, `—` (`.missing`) | — |

## States and accessibility

- **Focus:** a 2px `--focus` outline with a 3px offset on every interactive element. Never remove it.
- **Keyboard:** every action works from the keyboard in reading order. The tabs follow the ARIA tabs pattern, and the scrollable timeline frame is focusable.
- **Names:** icon-only and repeated buttons carry an `aria-label` that names their object ("Review Seara de gală for Teatrul Arcada").
- **Charts:** each timeline bar includes visually hidden text (`.sr-only`) describing the client, the campaign, the window and each part's state.
- **Errors:** they stay in the block that failed, using the existing `request-error` pattern, with a retry. Never use a full-screen banner.
- **Loading:** keep the final layout and labels in place. No shimmer, and nothing shifts when data lands.
- **Contrast:** every text colour reaches 4.5:1 on its surface, as the token tables above show.
- **Motion:** none beyond feedback. Short colour transitions on hover are dropped under `prefers-reduced-motion: reduce`.

## Don'ts

- Gradients on grounds, buttons, cards or text. Glows, glass or backdrop blur.
- Shadows on resting cards.
- Icons in tinted circles or squares, and icon-topped feature cards.
- Sparklines on KPIs, rainbow charts, or more than one hue per chart.
- Zebra striping, filled table header bands, uppercase or letter-spaced labels, or small labels stacked above headings.
- Violet or indigo accents, a cream ground with terracotta, or a dark or saturated sidebar on a light screen.
- Emoji, "Welcome back" greetings, placeholder people or companies, invented vanity figures.
- Monospace outside plates, IDs and code.
- A second primary button on a screen.

## Known gaps

These are inconsistencies in the current code, recorded here until someone decides how to resolve them:

- There are two reds: `--danger` `#b42318` (forms, `App.css`) and `--negative` `#c4242a` (data, dashboard).
- The data, status and pill tokens are scoped to `.dashboard`. The review dialog repeats `--rule` and `--negative` because it renders outside that scope, in the top layer.
- Older pages use a 24px `h1`; the dashboard uses 22px. The Users table's headers (13px/500 over a rule) don't match the dashboard tables'.
- `frontend/public/favicon.svg` is still Vite's violet bolt, not the brand mark.
- `frontend/index.html` still has the title "Users · Camioane App" and a "user management demo" description.

## Checking a UI change

1. From `frontend/`, run `npm run build` and `npm run lint`.
2. Look at the changed screen in a browser at 1440, 768 and 390px wide.
   - Check that the page never scrolls sideways.
   - Check that row-mates end level.
   - Check that every figure matches its copies elsewhere on the screen.
3. Optional: run the tasteskill gate the dashboard was built with:
   ```bash
   node <skill>/scripts/lint.mjs --app src/pages/<Page>
   node <skill>/scripts/inspect.mjs --app <url>
   ```
