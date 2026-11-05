# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This is `website/`, the public presentation site for advertisers: one static English landing page. The root `../CLAUDE.md` covers repo-wide rules. `AGENTS.md` in this folder holds the package's full rules; read it before changing anything. `README.md` covers setup and the env var. The shared tokens and the "Presentation site" section of `../DESIGN.md` define the visual system.

## Commands

Run these from `website/` with Node.js 24+ and npm.

- `npm ci`: install from the lockfile.
- `npm run dev`: start Vite at http://localhost:5174 with a strict port, because the admin app uses 5173.
- `npm run lint`: run Oxlint with the react, typescript and oxc plugins. It flags impure calls during render, such as `new Date()`; move them to module scope.
- `VITE_CONTACT_EMAIL=you@example.com npm run build`: run `tsc -b`, then `vite build` into `dist/`. Without a valid address, `vite.config.ts` throws on purpose. `loadEnv` also reads `VITE_*` from the shell, so an inline variable works without `.env.local`.
- `npm run preview`: serve the last build on port 5174.

There is no test runner and there are no tests. To check a change, run lint and build, then look at the page in a browser at 1440, 768 and 390px. Check that:
- the page never scrolls sideways
- there is exactly one `.button-primary`
- the header anchors land on their sections
- the call-to-action `href` is a `mailto:` link

## Architecture

- `src/App.tsx` renders the sticky header (skip link and anchor nav), then `<main>` with the sections in page order, then the footer. `html`'s `scroll-padding-top` in `src/index.css` matches the header's height, so anchor jumps land below it; change both together.
  - There is no router. Navigation uses the `#booking`, `#how-it-works`, `#pricing`, `#confirmation`, `#content` and `#contact` anchors, so each section's `id` must match the hrefs in the header's `navigation` array.
- `src/sections/` has one component per section, with each section's copy in arrays at the top of its file.
  - Every section except `Hero` wraps its content in `components/Section.tsx`. `Section` supplies the `id`, the heading tied by `aria-labelledby`, the lead paragraph and the layout: `layout="split"` (the default: heading in the left third, content in the right two thirds) or `layout="stacked"` (heading on top, content across the full column, laid out with the `.grid-2` and `.grid-3` column grids). An optional `className` styles one section, as `section-closing` puts the contact band on `--frame`.
  - `Hero` shows the title and buttons beside a panel holding only the example booking; the brand mark appears only in the header and footer.
- `src/lib/pricing.ts` is the only source of figures on the page.
  - `priceSlot(cars, bands)` turns the rate bands of the business plan's §7.2 example into rows, hours, car-hours and credits.
  - The hero chart (`sections/ExampleBooking.tsx`) and the pricing section's worked formula line, table and caption (`sections/Pricing.tsx`) all read `exampleSlot`.
  - The hero chart also derives its axis, ticks and bar positions from the band times. The axis runs from the hour the slot starts in to 30 minutes past the hour it ends in.
  - So editing the example updates the chart, the table, the captions and the totals together.
- `src/lib/contact.ts` builds `contactHref`, a `mailto:` link with a subject, from `VITE_CONTACT_EMAIL`. The contact band also offers "Copy address" through `navigator.clipboard`, hidden where the browser has no clipboard API, because a `mailto:` link does nothing without a mail app. The variable is typed in `src/vite-env.d.ts`, and `vite.config.ts` enforces it at build time.
- `src/lib/format.ts` copies the admin app's en-GB formats: counts, one-decimal hours, en-dash time windows and plurals.
- Styling is plain CSS, light theme only.
  - `src/index.css` holds tokens and primitives copied from `../frontend/src/index.css` and `App.css`: `.button`, `.button-primary`, `.num`, `.unit`, `.sr-only`, `.text-link` and the skip link.
  - `src/App.css` holds the layout, the hero chart and the price table.
  - At 959px the split layouts and the hero stack, three-column grids drop to two (three points drop to one), and the hero title shrinks to 40px. At 767px the gutters narrow for phones, every grid is one column, titles shrink, and the header nav collapses to the Contact button.
- `components/BrandMark.tsx` and `public/favicon.svg` copy the admin app's mark. The SVG outlines its wheels in `currentColor`, so the parent sets `color` to match the background behind it.

## Easy to break

- When a shared token changes in `../DESIGN.md`, update `src/index.css` too, because the copy here doesn't follow automatically.
- Keep one primary button on the page: "Plan a campaign" in the hero. Every other call to action, including the `<button>` "Copy address", uses the plain `.button` class.
- The header is sticky. Anything that changes its height must also change `scroll-padding-top` in `src/index.css`, and the skip link's `z-index` must stay above the header's.
- Keep the "not a price list" labels next to the pricing example.
