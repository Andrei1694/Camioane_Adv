# Frontend design

This guide describes the current Camioane App admin frontend and the conventions to follow when extending it. It is for developers and agents working in `frontend/`. The [root design guide](../DESIGN.md) remains the reference for shared brand, tokens and cross-platform rules; the [website guide](../website/DESIGN.md) describes the presentation site.

The values and component descriptions below come from the frontend source. Requirements describe how new work should behave, not a claim that every existing screen already meets them. Verified differences are recorded under [Current inconsistencies](#current-inconsistencies). Update this guide when a frontend token, size or pattern changes; update the root guide too when shared design rules change.

## Sources of truth

Styling uses plain CSS, with shared primitives and page-scoped selectors. There is no component library or global spacing/type token scale. Reuse existing components and classes before adding another pattern. Keep page-only UI beside its page; promote it to `src/components/` when another page actually uses it.

| Concern | Source |
| --- | --- |
| Global colours, font stacks, base elements, focus | [index.css](src/index.css) |
| Font imports | [main.tsx](src/main.tsx) |
| Buttons, fields, headings, Users table, pills, tabs, pagination, dialog frame | [App.css](src/App.css) |
| Navigation, brand mark, account block and sheet | [AppShell.tsx](src/components/AppShell.tsx), [AppShell.css](src/components/AppShell.css) |
| Dashboard layout, KPIs, fleet timeline, review queues | [DashboardPage](src/pages/DashboardPage/) |
| User management and its inline form | [UsersPage](src/pages/UsersPage/) |
| Car inventory, its inline form and delete dialog | [CarsPage](src/pages/CarsPage/) |
| Files table and preview | [FilesPage](src/pages/FilesPage/) |
| Credit balances, purchases and ledger | [CreditsPage](src/pages/CreditsPage/) |
| Profile screen | [ProfilePage](src/pages/ProfilePage/) |
| Campaign list, calendar, working hours and review | [CampaignPage](src/pages/CampaignPage/) |
| Preview, editing timeline and segment list | [VideoEditorPage](src/pages/VideoEditorPage/) |
| Stop editor, routing summary and map | [RouteBuilderPage](src/pages/RouteBuilderPage/) |
| Shared row identity and pagination | [OwnerLabel.tsx](src/components/OwnerLabel.tsx), [Pagination.tsx](src/components/Pagination.tsx) |
| Pictures and picture editing | [Avatar.tsx](src/components/Avatar.tsx), [Avatar.css](src/components/Avatar.css), [AvatarEditor.tsx](src/components/AvatarEditor.tsx), [AvatarEditor.css](src/components/AvatarEditor.css) |
| Upload feedback | [UploadProgress.tsx](src/components/UploadProgress.tsx), [UploadProgress.css](src/components/UploadProgress.css) |
| Notifications | [NotificationViewport.tsx](src/components/NotificationViewport.tsx), [NotificationViewport.css](src/components/NotificationViewport.css), [notifications.ts](src/lib/notifications.ts), [useNotify.ts](src/lib/useNotify.ts) |
| Shared number, money, size and timestamp formatting | [format.ts](src/lib/format.ts) |
| Routes and access boundaries | [App.tsx](src/App.tsx), [adminAccess.ts](src/auth/adminAccess.ts) |

## Design principles

- These are working screens for administrators. Lead with the screen's task, its relevant data and a clear next action.
- Keep navigation and surfaces quiet. Colour identifies data, meaningful status and the primary action.
- Use flat white surfaces, fine borders and restrained radii. Reserve elevation for floating UI.
- The frontend is Romanian-only, with diacritics and sentence case. Use consistent terms: „Panou de control”, „Mașini”, „Trasee”, „Campanii”, „Materiale publicitare”, „Credite”, „Fișiere”, „Utilizatori”, „Cont” and „Profil”. Car-hours are „ore-mașină”; rates use „cr/mașină-oră”. Keep the Camioane App brand unchanged.
- Compute totals from the same rows shown on screen. Print real zeros; show absent values as a muted em dash. State the comparison or time window behind a relative figure.
- Preserve information when a layout narrows: move fields onto labelled lines or scroll a bounded work area. The page itself should not scroll horizontally.
- Treat sample data and unfinished capabilities honestly. A saved campaign is a draft, and a route export is not a server-side save.

Avoid decorative gradients, glows, glass, tinted icon tiles, rainbow charts, KPI sparklines, zebra tables, uppercase tracked labels and ornamental welcome banners. The editor's CSS gradients draw timeline gridlines; they are not decorative surface treatments.

## Brand and colour

The shell identifies the product as **Camioane App**. Its 28px inline SVG mark is a car carrying a rooftop LED screen, drawn in `AppShell.tsx`. Brand navy is `#12263a`; bright cyan `#00c9e8` belongs to the mark. Use the darker `--data` cyan for readable data marks and selected states.

These custom properties are defined on `:root` in `index.css`. This table is a reference copy of the implementation, not a second token definition. The frontend is light-only (`color-scheme: light`).

| Token | Value | Role |
| --- | --- | --- |
| `--surface` | `#fff` | Sheet, panels and controls |
| `--text` | `#202020` | Main text |
| `--muted` | `#646464` | Supporting text, labels and units |
| `--border` | `#e5e5e5` | Surface boundaries and stronger rules |
| `--control-border` | `#b8b8b8` | Controls and dashed empty states |
| `--hover` | `#f5f5f5` | Hover and disabled fills |
| `--frame` | `#f3f6f8` | Shell ground and neutral media frames |
| `--primary` | `#12263a` | Primary action fill |
| `--primary-hover` | `#213d58` | Primary action hover |
| `--danger` | `#b42318` | Validation errors and destructive actions |
| `--focus` | `#245bba` | Keyboard focus outline |
| `--navigation-backdrop` | `rgb(32 32 32 / 35%)` | Modal and mobile navigation backdrop |
| `--data` | `#007c92` | Data marks, selected underline and progress |
| `--data-pale` | `#ddf5fa` | Scheduled or selected data areas |
| `--data-ink` | `#12263a` | Text on pale data areas |
| `--negative` | `#c4242a` | Failed checks and adverse data |
| `--positive` | `#247b50` | Positive outcomes |
| `--pill-positive-bg` / `--pill-positive-ink` | `#dcfae5` / `#04250e` | Positive status |
| `--pill-negative-bg` / `--pill-negative-ink` | `#ffedea` / `#831c1e` | Negative status |
| `--pill-warning-bg` / `--pill-warning-ink` | `#fffbeb` / `#92400e` | Waiting or warning status |
| `--pill-neutral-bg` | `#eef1f3` | Neutral status, with `--text` |
| `--rule` | `#eef1f3` | Fine row rules, grids and progress tracks |

Colour must have a semantic purpose. A credit increase or decrease is not automatically good or bad; signed ledger changes remain neutral. Pair status colour with text, a shape or another non-colour cue. For new colour combinations, verify readable contrast rather than assuming a token works on every background.

## Typography, spacing and surfaces

IBM Plex Sans 400, 500 and 600 are bundled through `@fontsource` in `main.tsx`. IBM Plex Mono 400 is also bundled and exposed through `--mono`, with system monospace fallbacks. Use mono for plates, IDs and code; use Sans with `.num` (`font-variant-numeric: tabular-nums`) for ordinary figures.

The root is 16px with a 1.5 line height. Most data screens explicitly use 14px text; shared form inputs inherit the surrounding font, so not every control has a 14px font size.

| Role | Current size and weight |
| --- | --- |
| Default page title | 24px / 600, line height 1.25 |
| Dashboard title | 22px / 600 |
| Campaign title on phones | 22px / 600 |
| Dialog title | 20px / 600 |
| Route and campaign totals | 20px / 400; campaign totals 18px at viewport widths up to 767px |
| Campaign name on the review stage | 20px / 500 |
| Shell product name | 18px / 600 |
| User form and profile section titles | 18px / 600 |
| Dashboard, credits, campaign and route section titles | 16px / 600 |
| KPI value | 28px / 400; 24px at viewport widths up to 767px |
| Typical data text and buttons | 14px / 400 or 500 |
| Users table cells and the dashboard's finding line | 15px |
| Supporting text and dense row actions | 13px |
| Table headers, pills and small captions | Usually 12px; Users headers are 13px / 500 |

Keep ordinary UI text at least 12px. Use `.unit` for muted suffixes, `.missing` for missing values, `.cell-sub` for a 12px secondary cell line, and `.sr-only` for accessible text that is visually hidden.

Spacing is expressed directly in CSS. Common gaps are 8px between actions, 12px within rows and 16–24px between groups. Dashboard layout tokens remain scoped to `.dashboard`: `--gap: 20px`, `--card-pad: 20px` (16px on phones), and `--radius-card: 10px`. Campaigns use their own `--campaign-gap: 20px`; do not assume those variables exist on other pages.

| Radius | Existing uses |
| --- | --- |
| 16px | Desktop sheet |
| 12px | Shared dialog |
| 10px | Dashboard panels, KPI strip and campaign calendar panel |
| 8px | Forms, review boxes, empty states, uploads, toasts, route panels and editor frames |
| 6px | Buttons, inputs, navigation links and notices |
| 4px | Pills and timeline segments |
| 50% | Avatars |

Resting panels use a 1px border without a shadow. Shared dialogs use `0 16px 48px rgb(18 38 58 / 18%)`. Notification toasts are bordered and have no shadow.

## Shell and responsive layout

The signed-in desktop shell is a 232px sidebar beside a white sheet. The sidebar is sticky, fills the viewport height and scrolls internally if needed. The sheet has an 8px outer inset on its top, right and bottom, a 1px border and a 16px radius. Default sheet padding is `40px clamp(24px, 4vw, 64px)`.

Navigation links use neutral `--border` fills for hover and the active page; the active label is weight 600. Outline icons are 20px. The account block contains a 40px avatar, email, role, Profile and Sign out. The email includes a preferred break before `@` and can wrap further to avoid overflow.

Management links depend on verified administrator access. Profile is available to every signed-in role. Failed access verification offers retry; denied accounts receive the account-access view. Do not use the displayed role label alone to decide whether to show management UI.

| Page | Content width | Desktop sheet padding |
| --- | --- | --- |
| Users, Profile and access views | Maximum 760px | Shell default |
| Dashboard | Full available width | 24px |
| Files, Credits and video editor | Full available width | Shell default |
| Cars and campaign list | Maximum 1100px | 28px 24px |
| Campaign creator and route builder | Maximum 1600px | 28px 24px |

Wide pages opt in through `.app-content:has(...)` selectors in their page stylesheet. Keep their grids shrinkable with `minmax(0, 1fr)` and `min-width: 0` where needed.

At viewport widths up to 767px, the sidebar becomes a header and native navigation dialog. The sheet loses its inset, border and radius. Default content padding becomes 28px 16px; the dashboard uses 20px 16px 32px, and cars, campaigns and routes use 24px 16px. The navigation dialog is at most 320px wide, closes on navigation, backdrop click or Escape, and closes when the viewport returns to desktop width.

The unsigned shell uses `.users-page`: a centred column up to 760px, 24px side gutters and 56px vertical margins. At 600px and below, its gutters become 16px and margins 28px. The login panel itself is capped at 460px.

### Viewport breakpoints

| Width | Current adaptation |
| --- | --- |
| Up to 1279px | Dashboard columns stack, with attention before the fleet timeline. Campaign progress wraps and monthly cell-hour labels are hidden. |
| Up to 1150px | Route map moves above the planner; the map is 400px tall and the planner has two columns. |
| Up to 1099px | Campaign calendar and detail editor stack; monthly cell-hour labels return if the calendar container is wide enough. |
| Up to 1023px | Dashboard KPIs become a 2 × 2 strip. |
| Up to 1000px | Route planner sections stack. |
| Up to 767px | Mobile navigation, larger dense actions, narrower dialogs and phone-specific page layouts. Route map height is 340px. |
| Up to 600px | Users form becomes one column and Users table becomes stacked rows. |

### Container breakpoints

These measure the component's available width, independently of the viewport.

| Container | Width | Current adaptation |
| --- | --- | --- |
| Dashboard fleet timeline | Up to 640px | Timeline keeps a 680px minimum inner width and scrolls within its frame; identity and hour corner remain pinned. |
| Dashboard routes panel | Up to 720px | Route rows wrap into labelled lines. |
| `files`, `credits`, `campaigns` | Up to 760px | Tables become stacked rows while preserving identity, figures and actions. |
| `cars` | Up to 759px | Filters become two columns with search spanning both; the form becomes one column. Rows stack with plate and status on the first line, muted 96px inline labels and 44px row actions. |
| `segments` | Up to 720px | Video segments wrap into labelled fields and actions. |
| `campaign-calendar` | Up to 640px | Monthly cell-hour labels hide; full accessible labels and selected-day detail retain the information. |

## Reusable patterns

### Buttons and fields

| Pattern | Class or element | Current treatment |
| --- | --- | --- |
| Primary action | `.primary-button` | Navy fill, white label; darker hover |
| Secondary action | `button` | White with a control border; minimum 44px height |
| Dense row action | `.ghost-button`, `a.ghost-button` | 32px minimum height, 13px text, bordered frame |
| Low-emphasis action | `.text-button` | 32px minimum height, transparent border and resting fill; hover uses the shared hover fill |
| Destructive action | `.danger` or Users `.delete-button` | Danger-coloured text |
| Icon action | `.icon-button` | 40px square with a 20px outline icon |

Ghost buttons, text buttons and tabs become at least 44px tall at 767px and below. Icon buttons need an explicit size override where a 44px touch target is required; the shared icon class remains 40px. Use links for navigation and buttons for actions. Icon-only controls need accessible names, and repeated row actions should name their object.

Design requirement: give each task one clear primary action. Show pending labels such as “Saving…” and disable conflicting actions. Explain non-obvious disabled states in nearby text connected with `aria-describedby`.

Use `.form-field` with a visible label, optional `.field-hint` and inline `.field-error`. Inputs, selects and textareas have a 1px control border, 6px radius and 44px minimum height. `aria-invalid="true"` supplies the danger border; associate validation messages with the field and focus the first invalid control. Textareas resize vertically. The Users form uses a two-column grid with a 20px gap and places Save and Cancel beneath it.

### Tables, lists and figures

Use semantic tables for multi-column data, retaining headers and accessible relationships when CSS stacks rows. The identity column gets room to wrap; secondary metadata sits below it. Align numeric columns and their headers to the right and use tabular figures. Standard data tables use 12px muted, regular-weight headers, fine row rules and no striping or filled header band. Users retains older table styling described under current inconsistencies.

`OwnerLabel` shows an email with “(you)” when appropriate, or “Deleted user”. `Pagination` renders a range such as “1–50 of 132” with Previous and Next, and hides itself when one page suffices. Pass the actual page size and total; short dashboard overview lists do not paginate.

Dashboard lists use a title and muted metadata, with trailing figures/actions and quiet row separators. The KPI strip is one divided card, currently four cells, with a muted label, regular-weight value and a note identifying its baseline. It is a dashboard pattern, not a global card component.

### Pills and tabs

Pills are 20px tall with 12px/500 text, 6px horizontal padding and a 4px radius. Use `.pill` with a positive, negative, warning or neutral modifier. Keep them unshrunk and unwrapped; place status beside the relevant identity rather than above a page title. Prefer one meaningful status per row.

Tabs use a 2px data-coloured selected underline over a 1px border rule. They are 40px tall on desktop and 44px on phones, with horizontal overflow contained inside the tab strip. ARIA tabs need a tablist, selected state, associated panels and arrow/Home/End navigation; CSS classes alone provide none of that behaviour. Campaign stages use `aria-current="step"` and are a separate progress pattern.

### Dialogs

Preview and review flows use native `<dialog>` with `showModal()`. The shared `.dialog` frame is at most 720px wide, with 24px padding, a 12px radius, a shadow and the shared backdrop. At 767px and below, it leaves 8px side clearance and uses 20px 16px padding. File previews retain that frame and size their media area in the Files page stylesheet.

Use `.dialog-head`, a named `h2`, a close button and an optional `.dialog-sub`. Review facts use `.review-checks`: an 88px label column beside the value, stacking on phones; `.check-fail` highlights a failed fact. Place errors and blocked-action explanations near the relevant action. Existing dialogs support Escape and backdrop dismissal. Preserve focus return to the opener, or a meaningful surviving control when that opener is removed.

For new destructive confirmations, follow the Cars delete dialog (`DeleteCarDialog.tsx`). The frame narrows to 480px, the title names the object (“Delete <plate>?”) and the description states the permanent effect. Cancel receives initial focus, and Escape or a backdrop click cancels while the dialog is idle. While the action runs, both buttons are disabled, the destructive label becomes “Deleting…” and dismissal is blocked. Failures stay inside the dialog; if the object has already gone, the destructive action is disabled and Cancel becomes Close. Older screens still use the browser's confirmation, as listed under [current inconsistencies](#current-inconsistencies).

### Avatars and upload progress

`Avatar` supports 32px table pictures, 40px account pictures and 96px editor pictures. Images crop with `object-fit: cover`; the email initial stays underneath while an image is unavailable or loading. Protected images are fetched with the session and displayed through object URLs.

`AvatarEditor` is shared by Profile and the Users edit form. Picture changes save immediately, independently of the user-details Save button. Keep that behaviour clear in its helper text. Actions sit beside the 96px circle and wrap when needed; progress appears below.

`UploadProgress` is shared by file uploads, avatar editing and video export uploads. It uses a bordered 8px-radius block and a 4px data-coloured progress bar. Bytes sent and total use the same unit. Distinguish sending from “Checking and saving…” after transfer; a full bar alone does not mean the server has completed the operation. Failures stay inline with Retry when supported and Dismiss. The bar exposes its label, value and descriptive progress text to assistive technology.

### Notifications

Use the session-bound `useNotify` callback for action outcomes. The [frontend README](README.md#action-notifications) documents its interface and lifecycle. Notifications are in memory, survive page navigation and clear on reload or session change; there is no notification history.

- Show at most three at once, queueing the rest in arrival order. Duplicate variant/message pairs reuse the existing notification without restarting its timer.
- Success and information default to five visible seconds; warnings and errors to eight. Notifications with actions, or duration `0`, remain until acted on or dismissed.
- Pause timers on hover, keyboard focus, hidden tabs and native modal dialogs. Modals defer both toast presentation and announcements.
- Announce errors through an alert live region and other variants through a status region, once per visible notification. Arrival does not move keyboard focus.
- Desktop placement is bottom right, up to 400px wide, with 24px minimum bottom/right offsets and safe-area handling. Phones use the bottom width between 16px gutters plus safe-area insets.
- Toasts use a white fill, control border, 8px radius and 14px text. A 20px outline icon and text label identify the variant. Dismiss controls are 40px on desktop and 44px on phones.

Keep validation, submission failures, query errors, authentication notices, upload/export progress and route-builder status inline. Do not repeat them as toasts. Emit outcomes from action handlers rather than query effects, and label dashboard actions as sample outcomes.

## Page conventions

### Dashboard

The dashboard uses invented rows from `sampleData.ts`; its actions change local state only. Keep the sample notice visible. `dashboardData.ts` computes totals, comparisons and review checks from those rows.

The main column contains the KPI strip and fleet timeline; the 384px rail holds attention and decision work, separated by a 20px gap. At narrower widths the action-bearing attention block precedes the timeline. Cars group by route, plates use mono and driver names are muted. Played segments use solid data cyan, scheduled segments pale cyan, missing playback evidence a dashed outline, undelivered content a negative outline and maintenance a hatch. Legends use the same marks as their segments. The now-line has its own label lane; booking labels must fit their segment.

### Cars

Cars (admin-only at `/cars`) answers which cars are in the fleet and runs on the real `/cars` API; the dashboard keeps its own sample fleet. The description says saved changes are shared with all administrators. Add car, the primary action, sits in the heading. Below it come the inline editor when open, labelled search, route and status filters, and a semantic table. The table caption holds the matching count (“3 of 12 cars”), announced politely, and a Clear filters text button. Columns are plate (mono), make/model, driver, route, status and Edit/Delete text actions named after the plate. Active, Maintenance and Inactive use the positive, warning and neutral pills. A missing driver or route prints a muted “Unassigned”. Explicit table roles keep row semantics when the rows stack.

The editor reuses the Users form frame and shared fields. While it is open, its Save takes the primary style and Add car and the row actions are disabled. Field errors sit beside their fields and focus moves to the first invalid one; request failures show in a focused inline alert. A pending save shows “Saving…”. A conflicting save keeps the entered values and offers Reload car, with a hint that reloading replaces them. Saving clears the filters so the record is visible, and closing returns focus to the opener, or to Add car when the opener has gone. Delete uses the confirmation dialog described under [Dialogs](#dialogs), and successful actions use success toasts.

Loading, an empty fleet, no filter matches, request failure and retry each have their own message. A failed background refresh labels the visible rows as the last loaded inventory, and the count shows “Refreshing…” while one runs.

### Users and Profile

Users has a semantic table with email/avatar, role and action columns. Add or Edit opens the form inline above the table; Add user remains visible but disabled while that form is open. Preserve focus entry into the form and return on close. Self-demotion and self-deletion are disabled with an explanation; deletion still uses the browser's confirmation (see current inconsistencies). Role labels come from `src/lib/user.ts`.

Profile stays in the 760px reading column and is available to every signed-in role. Its picture section uses `AvatarEditor`; the account section uses the shared facts/check layout. Editing a profile picture must update its representations across the shell and user views.

### Files

Files uses the real API and a full-width table. Identity includes filename and file type, followed by owner, upload timestamp, right-aligned size and row actions. Preview opens media in a dialog; Edit is a link for video files; Download and Delete are text actions. Narrow rows keep the owner on its own line so long emails remain readable. Upload feedback sits beneath the page heading; preview loading, unsupported media and retrieval failure remain in the preview frame.

### Credits

Credits separates pending purchases from account history. Review checks expose the amount, current balance and resulting balance before settlement. The adjust-balance form makes its signed change and reason explicit. Purchase status uses labels from `src/lib/credit.ts`; ledger changes include their sign and muted unit without automatic positive/negative colouring. Account history uses an account selector and tabs. Show one account's balance at a time; no all-account balances endpoint exists.

### Campaigns

The campaign list opens a draft creator/editor with Dates, Working hours and Review stages. A flexible calendar sits beside a 360px detail column with a 20px gap, stacking below 1100px. The monthly calendar is Monday-first with six week rows. Selection uses pale cyan plus a check/dot; today is underlined and the active day has its own treatment.

Date navigation supports arrows, Home/End and Page Up/Down with one date in the tab order. The working-hours calendar has sticky date headers, a 64px time axis and 64px per hour; its scrolling area is 65vh, bounded to 320–600px. It pages through selected days and shows one day on phones. Mouse/pen gestures can add ranges; touch scrolling remains available, and labelled selectors provide precise editing without dragging.

Use 15-minute increments; `24:00` is an end time only. Intervals may be adjacent but cannot overlap. Scheduling uses Europe/Bucharest calendar dates and wall-clock minutes. Past schedules are read-only; validation and conflict recovery stay visible in the editor. Totals sum valid nominal hours, without vehicle multipliers or billing conversions. Saving persists a shared draft with version checking; it does not launch the campaign or charge credits.

### Video editor

The full-width editor combines a stable media preview, playback/scrubbing controls, edit/history/zoom controls, a re-themed timeline and editable segment rows. The preview uses `object-fit: contain` on a neutral frame, with height `min(48dvh, 420px)` on desktop and `min(40dvh, 280px)` on phones.

The `<video>` element drives playback; the timeline visualizes edits and reports gestures. Keep segment bounds editable through labelled fields and buttons, not only drags. Render/export progress and failures remain inline. Export creates and uploads a new file; it does not replace the source. Timeline colours and typography follow the app tokens instead of the library's default theme.

### Route builder

The route builder combines a 320px planner and flexible MapLibre map with a 16px gap, in a content area capped at 1600px. The desktop map height is `clamp(440px, 64dvh, 760px)`; responsive stacking is described above. Keep attribution visible and preserve the map controls' 44px button geometry.

The stop list offers labelled latitude/longitude fields and keyboard-accessible reorder, remove and show-on-map actions alongside map gestures. The toolbar provides Fit route, Reverse, Undo and Clear. Routing and map failures show local explanations and retry actions; obsolete route geometry and summary must not appear current after calculation fails.

Distance and duration come from routing results. The visible limitation states that this is road routing without truck height, weight or access restrictions, traffic or breaks.

The heading holds New route, Saved routes, Export GeoJSON and the primary Save route. Save stores the name and ordered stops, shared with all administrators, and works even when routing fails. Export downloads the current calculated road geometry and stops. A bordered panel above the workspace holds the route-name field and a status line: New route, Unsaved changes, Saved, Saved route deleted, or the running action (“Saving route…”). Saved routes is a toggle (`aria-expanded`) that shows the library above that panel. The library lists name, stop count and updated day and time, with Open and Delete actions named after the route and shared pagination. The open route's row is marked with `aria-current` and the hover fill. The table frame is capped at 360px tall at every width, keeps its header row sticky and scrolls within itself. Opening a saved route recalculates the path.

Discarding unsaved edits and deleting a route both ask for confirmation. A conflicting save offers Reload route, and a route deleted elsewhere offers Save as new, both inline in the save panel. Editing and map gestures are disabled while a save, open or delete is in flight. Unfinished names, stops and the saved snapshot they are compared against stay per signed-in user in this tab's session storage.

## Data formatting

Use existing `ro-RO` formatters, keeping their input units and time zones distinct. Do not create inline alternatives for formats already covered by a helper. Currency codes and amounts, ISO dates, numeric input serialization, coordinates and video timecodes retain their technical notation.

| Value | Display convention | Source |
| --- | --- | --- |
| Counts and credits | `1.000`, with a muted `cr` suffix where needed | `formatCount` in `src/lib/format.ts` |
| One-decimal figures | `1.234,5` | `formatDecimal` |
| Signed credit change | `+1.000`, `−200`; neutral colour | `formatSignedCount` |
| Money | Minor units converted to currency decimals; `1.000,00 EUR` | `money`, `formatMoney` |
| File size | Decimal B/KB/MB/GB; B and KB whole, MB and GB one decimal | `byteSize`, `byteSizeIn`, `formatByteSize` |
| API timestamps | `mie., 4 nov. 2026`, `14:30`, in the browser's time zone | `formatLocalDay`, `formatLocalTime` |
| Waiting duration | Minutes in; `2 z 4 h`, `22 h 25 min`, `5 min` out | Shared `formatDuration` |
| Count with noun | `0 mașini`, `1 mașină`, `2 mașini`, `20 de mașini`, `101 mașini`; pass explicit singular and plural forms | `plural` with Romanian plural rules |
| Dashboard car-hours and times | One decimal for hours; 24-hour windows such as `17:00–20:00` | `src/pages/DashboardPage/dashboardData.ts` |
| Campaign schedule | Europe/Bucharest wall-clock dates/minutes; nominal totals such as `8 h 15 min`, retaining hours beyond 24 | `src/pages/CampaignPage/campaign.ts` |
| Video timecode | `0:12.4`, or `1:02:03.4` past one hour; source fields use seconds | `src/pages/VideoEditorPage/edit.ts` |
| Route distance and duration | Metres to one-decimal kilometres; seconds to minutes/hours, including `< 1 min` | `src/pages/RouteBuilderPage/route.ts` |
| Missing value | Muted `—`, distinct from a real zero | `.missing` |

Dashboard sample dates use UTC formatting to keep their authored calendar dates stable, and waiting times use the sample's own reference moment. Do not apply browser-local timestamp formatting to campaign calendar dates or silently interchange the route formatter's seconds with the shared duration formatter's minutes.

Translate application-controlled accessibility labels, placeholders, notifications, confirmations and validation alongside visible copy. MapLibre controls use Romanian labels. Native browser dialogs and media controls follow the browser's language. User data, filenames, route URLs, storage keys and API enum values are not translated.

The API returns English error text without stable error codes. `src/lib/apiErrorMessage.ts` translates known messages and parameterized validation at the shared fetch/XHR response boundary. Unknown messages use Romanian HTTP-status fallbacks. Keep these mappings aligned with backend changes; never display raw third-party video-export errors.

## States and accessibility

Existing UI uses text loading states, inline request errors, empty table rows and component-specific progress; there is no universal skeleton component. Use `.loading-state`, `.request-error`, `.field-error` and `.empty-state` where appropriate, without hiding the context of the task. Authentication and access checks can replace the protected content while verification is pending or fails.

Requirements for changes:

- Preserve meaningful headings, semantic tables and labelled controls. Retain accessible names and metadata when narrowing the layout.
- Keep the global `:focus-visible` outline: 2px `--focus`, offset 3px. Preserve the shell's Skip to content link and its focusable main target.
- Support keyboard operation and sensible focus return. Calendars, tabs, dialogs and editing tools each need their own interaction behaviour; a visual active state is insufficient.
- Target 44px touch controls on phones. Audit icon controls separately because the shared class does not enlarge them automatically.
- Use colour-independent status cues and verify text/background contrast. Do not treat this guide as an accessibility certification of the existing UI.
- Keep loading and failure feedback in the relevant region. Reserve stable space where practical; show retry only where the operation supports it. Avoid duplicate live announcements or toast/inline copies.
- Ask before leaving a page that would cancel running work. Files, `AvatarEditor` and the video editor block router navigation with `useBlocker`'s `shouldBlockFn` and enable `beforeunload` while an upload or export runs, and the video editor also while an edit is unexported; give new long-running transfers the same guard.
- Keep empty and missing data distinct from zero. Explain a useful next action instead of adding decorative illustrations or invented data.
- Limit motion to feedback. Existing sidebar and campaign-date colour transitions respect `prefers-reduced-motion`; apply that support to new motion too.

## Current inconsistencies

These are verified source-level differences to account for, not changes requested by this guide:

- Error text uses `--danger` while adverse data uses a different red, `--negative`.
- Default page titles are 24px, while the dashboard and phone campaign title use 22px. User form/profile section titles are 18px rather than the 16px used in data screens.
- Users table cells are 15px, headers are 13px/500, and its separators use `--border`; newer data tables generally use 14px cells, 12px/400 headers and `--rule`.
- The generic `.icon-button` remains 40px on phones; notifications and navigation supply larger targets separately.
- The Users empty row applies `.empty-state` directly to a table cell, inheriting the dashed block treatment.
- Deletion confirmation varies: Users, Files and saved routes use the browser's `window.confirm`, while Cars uses the native confirmation dialog described under [Dialogs](#dialogs).
- Saved-routes table headers are 12px / 500, unlike the 12px / 400 of other data tables.
- `index.html` uses `lang="ro"`, the default title “Administrare · Camioane App” and a Romanian administration description. `public/favicon.svg` still contains template artwork rather than the shell's car/screen mark.
- There is no global skeleton system or dark theme. Do not document either as an existing capability.

## Checking a change

For documentation-only changes, compare descriptions and values with the linked source, check relative links and review whitespace. Run `git diff --check`; check a newly created, untracked document separately because ordinary Git diff excludes it. Application builds and browser checks are unnecessary for prose-only updates.

For application changes, follow [AGENTS.md](AGENTS.md): run `npm run build` and `npm run lint` from `frontend/`, then exercise the changed UI in a browser when available. There is no frontend test runner; do not describe build/lint as passing tests. Write or modify tests, and inspect logs, only when explicitly requested.

For visual and interaction checks, use 1440px, 768px and 390px widths plus the affected component's breakpoint. Check keyboard operation, focus return, loading/empty/error/pending states, long filenames and emails, right-aligned figures, container scrolling and touch controls. Confirm that sample notices, draft/save semantics and formatting units remain accurate. Update this guide in the same change when a documented frontend pattern changes; coordinate shared token changes through the root guide.
