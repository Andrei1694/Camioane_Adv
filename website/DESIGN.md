# Design

This file describes the visual system of the public website (`website/`) as it is built. The site shares the admin app's brand, tokens and type. The shared tokens are defined in [`../DESIGN.md`](../DESIGN.md) and copied into `src/index.css`. Everything else here (layout, type sizes, components and patterns) belongs to the website alone. When the code changes a size or a pattern listed here, update this file in the same commit.

The site is one Romanian landing page for advertisers. People read it rather than work in it, so it follows the admin app's restraint at a reading pace. Colour belongs to the example data and the one action that matters. Type, rules and white space carry everything else.

## Sources of truth

| What | File |
| --- | --- |
| Shared tokens (the source the copies come from) | `../DESIGN.md`, `../frontend/src/index.css` |
| Tokens as the site uses them, base styles, link buttons, focus ring, skip link, scroll padding | `src/index.css` |
| Layout: sticky header, hero, split and stacked sections, column grids, example chart, price table, contact band, footer, breakpoints | `src/App.css` |
| Section frame and its two layouts | `src/components/Section.tsx` |
| The mark | `src/components/BrandMark.tsx`, `public/favicon.svg` |
| The pricing example and every figure on the page | `src/lib/pricing.ts` |
| Counts, hours, time windows and plurals | `src/lib/format.ts` |
| Contact address and the `mailto:` link | `src/lib/contact.ts` |
| Fonts | `src/main.tsx` (`@fontsource` imports) |

## Principles

- **One action.** The page's job is to start a conversation, so it has one primary button, "Planifică o campanie". Every other call to action is secondary.
- **Colour goes on data and the one primary action.** The only colour on the page is the example booking's `--data` bars and the navy primary button. Headers, sections and the footer stay neutral.
- **Surfaces are flat.** A 1px line or one step of tone (`--frame`) separates things. Nothing on the page has a shadow.
- **Use consistent Romanian terms:** mașini (cars), ore-mașină (car-hours), credite (credits), intervale (slots), trasee (routes), materiale publicitare (creatives).
- **Data is honest:**
  - Every figure is computed from `src/lib/pricing.ts`. Never type a total by hand.
  - A fact shown in two places is one value in the data: the hero total, the worked formula and the table total all read `exampleSlot.credits`.
  - The example always carries its "nu reprezintă o listă de prețuri" label.
- **Each section answers one question.** The hero answers "what is this, and how is it priced?". The sections then answer what you book, how a campaign runs, what it costs, what we promise, and how creatives reach the screens. The page closes with how to start.

## Brand

- **Name:** Camioane App.
- **Mark:** a car carrying a rooftop LED screen, copied from the admin app as `BrandMark`. It is 28px in the header and the footer, and it is the favicon. The wheels are outlined in `currentColor`, so the parent sets `color` to the ground behind it (`--surface`). The hero doesn't repeat the mark.
- **Colours:**

| Colour | Hex | Use | Contrast on white |
| --- | --- | --- | --- |
| Navy | `#12263A` | The mark, the primary button (`--primary`) | 15.4:1 |
| Cyan | `#00C9E8` | The mark only | 2.0:1: never use it for text or thin marks |
| Data cyan | `#007C92` | The example booking's bars (`--data`) | 4.9:1 |

## Tokens

### Colour (`src/index.css`, on `:root`)

These are copies of the shared tokens. Change a value in `../DESIGN.md` and `../frontend/src/index.css` first, then here. The site carries only the tokens it uses: when it needs a status, pill or danger colour, copy that token from `../DESIGN.md` rather than inventing a new one.

| Token | Value | Role on the site |
| --- | --- | --- |
| `--surface` | `#fff` | Page ground, header, buttons |
| `--text` | `#202020` | Primary ink (16.3:1 on white) |
| `--muted` | `#646464` | Leads, list lines, captions, units, nav links (5.9:1 on white, 5.5:1 on `--frame`) |
| `--border` | `#e5e5e5` | Header and section rules, hero panel edge, table header rule |
| `--control-border` | `#b8b8b8` | Secondary button edge |
| `--hover` | `#f5f5f5` | Button and nav link hover fill |
| `--frame` | `#f3f6f8` | Formula box, contact band: one low-chroma step of the navy |
| `--primary` | `#12263a` | Primary button fill, skip link |
| `--primary-hover` | `#213d58` | Primary button hover |
| `--focus` | `#245bba` | Focus ring |
| `--data` | `#007c92` | Exemplu de rezervare bars |
| `--rule` | `#eef1f3` | Row rules: steps, grid items, table rows, chart gridlines |

### Layout values (`src/App.css`)

| Value | Size |
| --- | --- |
| Content column | 1080px, with 24px gutters (16px under 768px) |
| Header | 72px tall (64px under 768px) |
| Section padding | 80px top and bottom (56px under 768px) |
| Hero padding | 80px (48px top, 56px bottom under 768px) |
| Page minimum width | 280px (`body`) |

## Type

- **Face:** IBM Plex Sans 400, 500 and 600, self-hosted through `@fontsource`, so there are no third-party font requests. The site doesn't load Plex Mono, because nothing on the page is a plate or an ID.
- **Scale:**

| Role | Size | Weight |
| --- | --- | --- |
| Hero title (`h1`) | 48px (40px under 960px, 32px under 768px), line height 1.15, tracking −0.01em, balanced | 600 |
| Section title (`h2`) | 28px (24px under 768px), line height 1.2, tracking −0.01em, balanced | 600 |
| Example total | 28px, tracking −0.01em, with a 16px grey "cr" | 400 |
| Lead under a title | 18px, `--muted`, line height 1.6 | 400 |
| Brand name | 18px in the header, 16px in the footer | 600 |
| Body, list titles (`h3`, 16px/600), buttons, nav links, table cells | 16px, line height 1.6 | 400 / 500 |
| Table caption, table note, footer, contact status | 14px, `--muted` | 400 |
| Example meta line, table headers | 13px, `--muted` | 400 |
| Chart labels, hour ticks, rates over the bars, example caption | 12px | 400 / 500 |

- Nothing goes below 12px.
- Every number uses tabular figures (`.num`).
- Use sentence case everywhere: no uppercase or letter-spaced labels.
- Units are a grey suffix inside the same element: `80` + `<span class="unit"> cr</span>`.
- Titles use `text-wrap: balance`. Leads and grey list lines use `text-wrap: pretty`, so a paragraph doesn't end on one word.

## Layout

- **Frame:** no sidebar or sheet. A white page under a sticky header, then the hero, then the sections, each opening with a 1px `--border` rule, then the footer.
- **Sticky header:** solid `--surface` with a 1px `--border` rule underneath, and no shadow or blur. `html` has a matching `scroll-padding-top` (72px, 64px under 768px), so every anchor jump lands its heading below the header. The skip link (`z-index: 20`) sits above the header (`z-index: 10`). If the header's height changes, change the scroll padding with it.
- **Section layouts** (`Section`'s `layout` prop):
  - **Split** (the default): the heading and its lead in the left third, and the content in the right two thirds, 48px apart. Use it for content that reads top to bottom. Under 960px they stack, 24px apart.
  - **Stacked:** the heading and its lead on top (at most 40em wide), then content across the whole column, 40px below (32px under 768px). Use it for lists that read side by side.
- **Page order:**

| Section | Anchor | Layout | Content |
| --- | --- | --- | --- |
| Hero | `#top` | Own grid | Title, lead, buttons; the example booking panel |
| Ce rezervi | `#booking` | Stacked | Six terms in three columns |
| Cum se desfășoară o campanie | `#how-it-works` | Split | Seven numbered steps |
| Tarife în credite | `#pricing` | Split | Formula box, example table, note |
| Totul sau nimic | `#confirmation` | Stacked | Four points, 2 × 2 |
| Materialele tale publicitare pe ecrane | `#content` | Stacked | Three points in three columns |
| Planifică prima ta campanie | `#contact` | Stacked, `section-closing` | The contact band |

- **Breakpoints (viewport):**

| Width | Change |
| --- | --- |
| ≤ 959px | The hero and the split sections stack. The hero panel takes the column's full width. The hero title is 40px. Three-column grids become two, except three points, which become one column at most 40em wide. |
| ≤ 767px | Gutters narrow to 16px and the header to 64px. The header nav collapses to the Contact button. Titles shrink (h1 32px, h2 24px), and so does section padding (56px). Every grid becomes one column with 24px gaps. In the contact band the address takes its own line. |

- The page never scrolls sideways. A wide table may scroll inside its own frame (`.table-frame`).

## Surfaces and radii

- **Grounds:** the page is `--surface`. The formula box and the contact band are `--frame`, one step of tone. There are no other fills.
- **Shadow:** none.
- **Radius scale:**

| Radius | Used on |
| --- | --- |
| 10px | Hero panel |
| 8px | Formula box |
| 6px | Buttons, nav links, skip link |
| 4px | Chart bars |

## Components

### Buttons (`src/index.css`)

| Kind | Class | Look | Use |
| --- | --- | --- | --- |
| Primary | `.button.button-primary` | Navy fill, white label | "Planifică o campanie" in the hero. One per page. |
| Secondary | `.button` | White, 1px `--control-border` | "Cum se calculează costul", the header's Contact, "Scrie-ne", "Copiază adresa" |
| Text link | `.text-link` | Ink, underlined 3px below | "Contactează-ne" in the pricing note |

- Buttons are 44px tall with 20px of side padding and 16px/500 labels, and they don't wrap.
- Most buttons are links. A `<button class="button">` ("Copiază adresa") inherits the same font and weight.
- Hover changes only the fill (`--hover`, or `--primary-hover` on the primary), over 120ms.

### Header and navigation (`App.tsx`)

- The brand (the mark and "Camioane App") on the left links to `#top`.
- On the right are the section links "Ce rezervi", "Cum funcționează" and "Tarife": grey 16px/500, 44px tall, 12px of side padding and a 6px radius. They get the `--hover` fill and ink on hover. Then comes Contact, a secondary button 8px further along.
- Under 768px only Contact stays. The sticky header keeps it on screen.
- Each section's `id` must match a link's `href`.

### Hero (`sections/Hero.tsx`)

- Two columns: the text, and the 460px panel, 56px apart (40px apart once stacked), centred against each other.
- The text: the title (at most 14em wide), then the lead (18px grey, at most 34em, 20px below), then "Planifică o campanie" (primary) and "Cum se calculează costul" (secondary), 32px below with 12px between them.
- The panel: a 1px `--border` edge and a 10px radius, holding only the example booking.

### Exemplu de rezervare (`sections/ExampleBooking.tsx`)

- A small timeline of the pricing example, every part of it derived from `exampleSlot`. It has 24px of padding (20px and 16px on phones).
- **Title row:** "Exemplu de rezervare" (16px/600) over a grey 13px meta line ("2 mașini · 16:30–18:00 · 3,0 ore-mașină"). The total sits on the right at 28px with a grey "cr".
- **Chart:** 24px below the title row, with rows 8px apart. Each row has a 44px label column (12px grey) and a track.
  - The axis runs from the hour the slot starts in to 30 minutes past the hour it ends in. Hour ticks are 12px grey and centred on their hour (`16:00`).
  - The "Tarif" row centres each band's rate (12px/500) over that band.
  - Each car is a row of 24px solid `--data` bars, one per rate band, with a 4px radius. Where the rate changes, a 2px seam splits them.
  - Gridlines are 1px `--rule` at each hour, extending 4px above and below each track.
- **Caption:** 12px grey, 16px below: "Tarife în credite pe oră-mașină. Valorile ilustrează calculul și nu reprezintă o listă de prețuri."
- The chart is `aria-hidden`. A visually hidden sentence describes it in full ("2 mașini pe un traseu, 16:30–17:00 la 20 de credite pe oră-mașină, apoi 17:00–18:00 la 30 de credite pe oră-mașină.").

### Lists (`sections/Booking.tsx`, `HowItWorks.tsx`, `Confirmation.tsx`, `Content.tsx`)

- **Terms** ("Ce rezervi"): a definition list in a three-column grid. Each term is 16px/600 over its grey line.
- **Steps** ("Cum se desfășoară o campanie"): a numbered list. Each step's number sits in a grey 32px column (600, tabular), 16px from its title, with its grey line under the title. Steps are 16px apart in padding, with a 1px `--rule` between them and no rule above the first.
- **Points** ("Totul sau nimic", "Materialele tale publicitare pe ecrane"): a 16px/600 `h3` over a grey line, 4px apart.
- **Column grids** (`.grid-2`, `.grid-3`): used by the stacked sections. Each item opens with a 1px `--rule` line and 16px of space. Gaps are 32px down and 40px across (24px in one column).
- No icons, cards, fills or numbered circles.

### Pricing (`sections/Pricing.tsx`)

- **Formula box:** `--frame`, an 8px radius, 16px × 20px of padding, with lines 8px apart:
  1. **Costul unui interval** = numărul de mașini × suma (orelor din fiecare segment tarifar × tariful segmentului)
  2. A grey "Pentru exemplul de mai jos:" followed, in ink, by the example worked through: "2 × (0,5 h × 20 + 1,0 h × 30) = 80 cr". It is built from `exampleSlot`, and no band's term ever wraps inside itself.
  3. **Costul campaniei** = suma costurilor tuturor intervalelor, pentru toate datele
- **Table** (`.price-table`), 32px below:
  - A caption names the example: 14px grey, above the table.
  - Headers are 13px grey, regular weight and sentence case, over a 1px `--border` rule, with no fill band.
  - Rows have 12px of cell padding (8px on phones) and 1px `--rule` lines, and aren't striped.
  - The rate band is the row header. Hours, rate, cars and credits are right-aligned in tabular figures, and credits carry a grey "cr".
  - The total row is 600 weight with no rule under it.
- **Note:** 14px grey, 16px below: "Tarifele din exemplu ilustrează calculul și nu reprezintă o listă de prețuri. Contactează-ne pentru tarifele traseelor tale."

### Contact band (`sections/Contact.tsx`)

- The last section sits on `--frame` in place of its top rule, a step of tone that closes the page.
- Its actions sit in one row that wraps, 12px apart down and 20px across:
  - "Scrie-ne": a secondary button linking to `mailto:` with the subject "Campanie publicitară".
  - The address, in ink at 500 weight, which may break anywhere so it never overflows.
  - "Copiază adresa": a secondary `<button>` for visitors without a mail app. It is hidden where the browser has no clipboard API.
- A grey 14px `role="status"` line, 12px below, reports "Adresa a fost copiată." or "Adresa nu a putut fi copiată. Selecteaz-o și copiaz-o manual." It takes no space while empty.
- Under 768px the address takes its own line above the two buttons. The tab order is unchanged, because the address isn't focusable.

### Footer (`App.tsx`)

- 32px of padding over a 1px `--border` rule, 14px grey: the brand (16px) on the left, and "© {year} Camioane App · Publicitate pe mașini cu ecrane LED" on the right. The two wrap with gaps of 8px down and 24px across.
- The year is read once when the page loads.

## Formatting data

Use the helpers in `src/lib/format.ts`, with `ro-RO` number and plural rules; don't format inline. The admin app keeps its own locale. `plural(count, one, many)` requires explicit singular and plural forms and inserts `de` for integer counts in the Romanian `other` category.

| Value | Format | Helper |
| --- | --- | --- |
| Credits | Whole number with a Romanian thousands separator (`1.000`) and a grey "cr" suffix: `80 cr` | `formatCount` |
| Hours and car-hours | Always one decimal with a comma: `0,5`, `3,0` | `formatHours` |
| Rates | A bare number under a header or caption that names the unit ("Tarif (cr/oră-mașină)", "Tarife în credite pe oră-mașină") | `formatCount` |
| Time | 24-hour clock: `16:30`; ranges with an en dash: `16:30–18:00` | `formatWindow` |
| Counts with nouns | Romanian noun forms: `1 mașină`, `2 mașini`, `20 de mașini` | `plural` |
| Separators | A middle dot between parts of a meta line: `2 mașini · 16:30–18:00 · 3,0 ore-mașină` | — |

## Content

- Romanian only, with correct diacritics and a friendly, direct tone. Keep `Camioane App` and existing anchor IDs unchanged. The page uses `lang="ro"`, Romanian title/description metadata, and the email subject "Campanie publicitară". There is no language switcher.
- The copy comes from `../BUSINESS_PLAN.md`, confirmed rules only. Things the plan lists as still unknown (cities, fleet size, real rates, the credit price, cancellation terms) don't appear.
- There are no invented clients, testimonials, logos, vanity figures, stock photos or placeholder people.
- Lists of terms, steps and points sit in arrays at the top of their section's file. Titles and leads are written inline.
- The only call to action is the `mailto:` link built from `VITE_CONTACT_EMAIL`. Don't add forms or lead capture until the backend has an endpoint for them.

## States and accessibility

- **Landmarks:** a skip link to `#main`, then `header` with `nav aria-label="Secțiuni"`, then `main`, then `footer`. Every section is a `section` with `aria-labelledby` pointing at its heading.
- **Focus:** a 2px `--focus` outline with a 3px offset on every interactive element. Never remove it. The skip link slides in on focus, above the sticky header.
- **Keyboard:** every control works from the keyboard in reading order, and the sticky header never covers a focused control.
- **Charts:** the example chart is hidden from assistive technology, and its visually hidden sentence states the same facts.
- **Status:** the copy outcome is announced through `role="status"`.
- **Touch:** buttons and nav links are at least 44px tall.
- **Contrast:** every text colour reaches 4.5:1 on its ground (see the tokens table).
- **Theme:** light only (`color-scheme: light`).
- **Motion:** none beyond 120ms colour transitions on button hover, which are dropped under `prefers-reduced-motion: reduce`. Anchor jumps are instant, not smooth-scrolled.

## Don'ts

- A second primary button.
- Forms, lead capture, chat widgets or anything else that calls an API.
- Typing a figure by hand, or showing the pricing example without its "nu reprezintă o listă de prețuri" label.
- Invented cities, fleet sizes, prices, clients, testimonials, logos or vanity figures. Stock photos or placeholder people.
- Gradients, glows, glass or backdrop blur. Shadows, including on the sticky header.
- Icons in tinted circles or squares, icon-topped feature cards, or cards around list items.
- Uppercase or letter-spaced labels, or small labels stacked above headings.
- Violet or indigo accents, or a dark or saturated band. The page's only tone step is `--frame`.
- Emoji, and monospace text.
- Colour on anything but the example data and the primary button.

## Known gaps

- At 320px the price table is about 60px wider than its frame and scrolls inside it. The page itself doesn't scroll. Letting the "Tarif (cr/oră-mașină)" header wrap would fix it.

## Checking a change

1. From `website/`, run `npm run lint` and `VITE_CONTACT_EMAIL=you@example.com npm run build`. There is no test runner.
2. Look at the page in a browser at 1440, 768 and 390px wide.
   - Check that the page never scrolls sideways.
   - Check that there is exactly one `.button-primary`, and that the calls to action are `mailto:` links.
   - Check that each header link and "Cum se calculează costul" lands its heading below the sticky header.
   - Check that every figure matches its copies: the hero total, the worked formula and the table total.
   - Tab through the page and check that the focus ring shows on every control, with nothing hidden under the header.
3. When a token, size or pattern changes, update this file in the same commit. When a shared token changes, update `../DESIGN.md` and `../frontend/src/index.css` too.
