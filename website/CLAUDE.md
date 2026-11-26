# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read and follow [CLEAN_CODE.md](../CLEAN_CODE.md) when writing or changing code.
It defines the shared JavaScript/TypeScript function conventions; continue
following the package-specific rules as well.

This is `website/`, the Romanian presentation site and sign-in/account area for advertisers. The root `../CLAUDE.md` covers repo-wide rules. `AGENTS.md` in this folder holds the current package rules; read it before changing anything. `README.md` covers setup, sessions, routes and environment variables. `DESIGN.md` defines the website's visual system.

## Commands

Run these from `website/` with Node.js 24+ and npm.

- `npm ci`: install from the lockfile.
- `npm run dev`: start Vite at http://localhost:5174 with a strict port, because the admin app uses 5173.
- `npm run lint`: run Oxlint with the react, typescript and oxc plugins. It flags impure calls during render, such as `new Date()`; move them to module scope.
- `VITE_CONTACT_EMAIL=you@example.com npm run build`: run `tsc -b`, then `vite build` into `dist/`. Without a valid address, `vite.config.ts` throws on purpose. `loadEnv` also reads `VITE_*` from the shell, so an inline variable works without `.env.local`.
- `npm run preview`: serve the last build on port 5174.

Run the existing Vitest suite with `npm test`, then lint and build. Do not add or modify tests unless explicitly requested. Check the pages in a browser at 1440, 768 and 390px. On the landing page, check that:
- the page never scrolls sideways
- there is exactly one `.button-primary`
- the header anchors land on their sections
- the call-to-action `href` is a `mailto:` link

## Architecture

- `src/App.tsx` renders the sticky header (skip link and anchor nav), then `<main>` with the sections in page order, then the footer. `html`'s `scroll-padding-top` in `src/index.css` matches the header's height, so anchor jumps land below it; change both together.
  - The landing page keeps native section anchors and remains independently renderable. Its account link opens `/account`.
  - `src/router.tsx` wraps routes with TanStack Query and Router providers. `/login` signs in, `/account` verifies the session and shows read-only details for every active role, and `/index.html` redirects to `/` while preserving its hash.
  - `src/auth/session.ts` uses Zustand and `camioane.website.session.v1`, separate from admin. Persist only token/expiry; session changes abort requests, clear Query data, and remount route content. Local forms and clipboard feedback remain in React state.
  - `src/components/AccountLayout.tsx` provides the shared account header, main landmark, focus management, storage notices and footer. Login/account styles live beside it in `AccountLayout.css`.
- `src/sections/` has one component per section, with each section's copy in arrays at the top of its file.
  - Every section except `Hero` wraps its content in `components/Section.tsx`. `Section` supplies the `id`, the heading tied by `aria-labelledby`, the lead paragraph and the layout: `layout="split"` (the default: heading in the left third, content in the right two thirds) or `layout="stacked"` (heading on top, content across the full column, laid out with the `.grid-2` and `.grid-3` column grids). An optional `className` styles one section, as `section-closing` puts the contact band on `--frame`.
  - `Hero` shows the title and buttons beside a panel holding only the example booking; the brand mark appears only in the header and footer.
- `src/lib/pricing.ts` is the only source of figures on the page.
  - `priceSlot(cars, bands)` turns the rate bands of the business plan's §7.2 example into rows, hours, car-hours and credits.
  - The hero chart (`sections/ExampleBooking.tsx`) and the pricing section's worked formula line, table and caption (`sections/Pricing.tsx`) all read `exampleSlot`.
  - The hero chart also derives its axis, ticks and bar positions from the band times. The axis runs from the hour the slot starts in to 30 minutes past the hour it ends in.
  - So editing the example updates the chart, the table, the captions and the totals together.
- `src/lib/contact.ts` builds `contactHref`, a `mailto:` link with a subject, from `VITE_CONTACT_EMAIL`. The contact band also offers "Copiază adresa" through `navigator.clipboard`, hidden where the browser has no clipboard API, because a `mailto:` link does nothing without a mail app. The variable is typed in `src/vite-env.d.ts`, and `vite.config.ts` enforces it at build time.
- `src/lib/format.ts` uses Romanian formats: counts, one-decimal hours, en-dash time windows and plurals.
- `src/lib/api.ts` provides public health/login and authenticated account requests. It validates responses, adds a 15 s timeout, and rejects stale session responses. A protected 401 signs out; connection failures permit retry. The landing page never calls it. `src/auth/errorMessage.ts` translates authentication failures into Romanian without changing the existing health-client error contract.
- `VITE_API_BASE_URL` falls back to `http://localhost:3000` only in development. Production builds can omit it, but account routes then show authentication-unavailable feedback. The backend must allow the website through `WEBSITE_ORIGIN`.
- Caddy rewrites only `/login`, `/account` and their trailing-slash variants to the entry document. Unknown routes and missing assets remain 404; do not introduce a catch-all fallback.
- Styling is plain CSS, light theme only.
  - `src/index.css` holds tokens and primitives copied from `../admin/src/index.css` and `App.css`: `.button`, `.button-primary`, `.num`, `.unit`, `.sr-only`, `.text-link` and the skip link.
  - `src/App.css` holds the layout, the hero chart and the price table.
  - Below 1024px, the hero and split layouts stack and the header hides section links. Contact and "Contul meu" stay available. Below 768px, gutters narrow, content grids become one column and headings shrink; below 480px, the header keeps the brand mark but hides its wordmark.
- `components/BrandMark.tsx` and `public/favicon.svg` copy the admin app's mark. The SVG outlines its wheels in `currentColor`, so the parent sets `color` to match the background behind it.

## Easy to break

- When a shared token changes in `../DESIGN.md`, update `src/index.css` and the token table in `DESIGN.md` too, because the copies here don't follow automatically.
- When a size or pattern changes here, update `DESIGN.md` in the same commit.
- Keep one primary action per view. The landing hero uses "Planifică o campanie" and login uses "Autentificare". Verified account details need only a secondary sign-out button.
- The header is sticky. Anything that changes its height must also change `scroll-padding-top` in `src/index.css`, and the skip link's `z-index` must stay above the header's.
- Keep the "not a price list" labels next to the pricing example.
