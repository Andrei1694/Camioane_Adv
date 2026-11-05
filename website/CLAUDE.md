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

- `src/App.tsx` renders the header (skip link and anchor nav), then `<main>` with the sections in page order, then the footer.
  - There is no router. Navigation uses the `#booking`, `#how-it-works`, `#pricing`, `#confirmation`, `#content` and `#contact` anchors, so each section's `id` must match the hrefs in the header's `navigation` array.
- `src/sections/` has one component per section, with each section's copy in arrays at the top of its file.
  - Every section except `Hero` wraps its content in `components/Section.tsx`. `Section` supplies the `id`, the heading tied by `aria-labelledby`, the lead paragraph, and the one-third/two-thirds grid.
- `src/lib/pricing.ts` is the only source of figures on the page.
  - `priceSlot(cars, bands)` turns the rate bands of the business plan's §7.2 example into rows, hours, car-hours and credits.
  - Both the hero chart (`sections/ExampleBooking.tsx`) and the pricing table and its caption (`sections/Pricing.tsx`) read `exampleSlot`.
  - The hero chart also derives its axis, ticks and bar positions from the band times. The axis runs from the hour the slot starts in to 30 minutes past the hour it ends in.
  - So editing the example updates the chart, the table, the captions and the totals together.
- `src/lib/contact.ts` builds `contactHref`, a `mailto:` link with a subject, from `VITE_CONTACT_EMAIL`. The variable is typed in `src/vite-env.d.ts`, and `vite.config.ts` enforces it at build time.
- `src/lib/format.ts` copies the admin app's en-GB formats: counts, one-decimal hours, en-dash time windows and plurals.
- Styling is plain CSS, light theme only.
  - `src/index.css` holds tokens and primitives copied from `../frontend/src/index.css` and `App.css`: `.button`, `.button-primary`, `.num`, `.unit`, `.sr-only`, `.text-link` and the skip link.
  - `src/App.css` holds the layout, the hero chart and the price table.
  - At 959px the two-column layouts stack. At 767px the gutters narrow for phones and the header nav collapses to the Contact button.
- `components/BrandMark.tsx` and `public/favicon.svg` copy the admin app's mark. The SVG outlines its wheels in `currentColor`, so the parent sets `color` to match the background behind it.

## Easy to break

- When a shared token changes in `../DESIGN.md`, update `src/index.css` too, because the copy here doesn't follow automatically.
- Keep one primary button on the page: "Plan a campaign" in the hero. Every other call to action uses the plain `.button` class.
- Keep the "not a price list" labels next to the pricing example.
