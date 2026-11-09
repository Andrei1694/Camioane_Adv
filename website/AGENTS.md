# Website agent guidance

These instructions apply to `website/` and its descendants. Keep website work
scoped here unless the requested change also requires changes elsewhere.

## User workflow preferences

- Do not write new tests or modify existing tests unless the user explicitly
  requests it. Feature implementation, bug fixes, and refactors do not imply a
  request to write tests.
- Do not read, inspect, search, tail, or retrieve logs unless the user explicitly
  requests it. This includes browser, application, server, and system logs.

## Project context

- This is the public presentation site for advertisers: one Romanian landing page
  with anchored sections (`#booking`, `#how-it-works`, `#pricing`,
  `#confirmation`, `#content`, `#contact`). It is set up like `../frontend/`
  (React, TypeScript, Vite, Oxlint, plain CSS) but is a separate package with its
  own dependencies; never import from `../frontend/`.
- `src/lib/api.ts` is the typed fetch client for the backend: base URL from
  `VITE_API_BASE_URL` (development falls back to `http://localhost:3000`), a 15 s
  timeout, `{ error }` messages and a runtime decoder for every response. No
  section calls it yet. Add calls only for endpoints listed in
  `../backend/README.md`; never invent one. The backend allows this site's origin
  through `WEBSITE_ORIGIN`.
- The call to action is a `mailto:` link built in `src/lib/contact.ts` from
  `VITE_CONTACT_EMAIL`; `vite.config.ts` fails a build without it. Do not add
  forms or lead capture until the backend has an endpoint for them.
- Copy comes from `../BUSINESS_PLAN.md`, confirmed rules only. Do not invent
  cities, fleet sizes, rates, credit prices, client names, testimonials or other
  figures. Use the Romanian terms from `DESIGN.md`: mașini, ore-mașină, credite,
  intervale, trasee, materiale publicitare.
- `src/lib/pricing.ts` holds the illustrative pricing example and computes every
  figure the page shows from its rows. Never type a total by hand, and keep the
  "not a price list" labels next to the example.
- Use npm. `package.json` and `package-lock.json` are authoritative; keep them in
  sync. Add dependencies only when the work needs them.

## Commands

Run these commands from `website/`:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install dependencies from the lockfile |
| `npm run dev` | Start Vite on port 5174 |
| `npm run build` | Type-check and produce `dist/` (needs `VITE_CONTACT_EMAIL`) |
| `npm run lint` | Run Oxlint |
| `npm test` | Run the logic and React component tests once |
| `npm run test:watch` | Watch and rerun affected tests |
| `npm run test:coverage` | Run tests with terminal and HTML coverage reports |
| `npm run preview` | Preview the production build on port 5174 |

Tests live in `tests/` and use Vitest, jsdom, and React Testing Library, configured
separately in `vitest.config.ts`. Use explicit test imports, accessible queries,
and focused behavioral assertions. Mock network and clipboard access; do not
require a running backend or read real environment values. Account for
module-load environment and capability checks before importing the target.
Shared setup restores DOM, mocks, timers, environment overrides, and clipboard
state. Coverage is informational, includes untested application modules, and
excludes declarations and the bootstrap entry point. Do not report tests as
passing when only the build and lint checks were run.

## Code conventions

- Two-space indentation, single quotes, no semicolons, `import type` for
  type-only imports, relative imports only. Function components with hooks;
  `.tsx` for JSX, `.ts` otherwise. Keep `erasableSyntaxOnly` and the unused-code
  checks; do not weaken compiler checks.
- `src/sections/` holds one component per page section; `src/components/` holds
  pieces used by more than one section (`Section`, `BrandMark`); `src/lib/` holds
  formatting, pricing and contact helpers and the API client.
- Tokens and primitives in `src/index.css` are copied from
  `../frontend/src/index.css` and `App.css`. When a shared token changes in
  `../DESIGN.md`, change it in `src/index.css` and in the token table of
  `DESIGN.md` too. Page layout lives in `src/App.css`.

## UI and verification

- Follow `DESIGN.md` in this folder; the shared tokens come from `../DESIGN.md`.
  Update `DESIGN.md` in the same commit when you add or change a token, size or
  pattern here.
- Use semantic elements, visible keyboard focus and layouts that work on narrow
  screens; the page never scrolls sideways. Keep one primary button on the page.
- After changing code, tests, dependencies or build configuration, run `npm test`, `npm run lint`
  and `npm run build` (with `VITE_CONTACT_EMAIL` set). When a browser is
  available, check the page at 1440, 768 and 390px wide.
