# Camioane App website

The public presentation site for advertisers: one Romanian landing page that explains what a campaign books (routes, slots, cars, dates), how a campaign runs, pricing in credits per car-hour with a worked example, the all-or-nothing confirmation, and how creatives reach the screens. Its call to action is a `mailto:` link.

It is a static React, TypeScript and Vite app, set up like `../frontend/`, with plain CSS and IBM Plex Sans self-hosted through `@fontsource`. It has no router, state or data libraries. `src/lib/api.ts` is a typed client for the backend API, but no section calls it yet, so the page works without a running API.

## Development

Use Node.js 24+ and npm. From `website/`:

```sh
npm ci
npm run dev
```

Open `http://localhost:5174`. Development and preview use port 5174 with strict port selection, so the site runs beside the admin app on 5173.

## Configuration

| Variable | Required | Use |
| --- | --- | --- |
| `VITE_CONTACT_EMAIL` | For builds | The address behind "Planifică o campanie" and "Scrie-ne", and shown as text in the contact section. `vite build` fails when it's missing or not an address. Development falls back to `hello@example.com`. |
| `VITE_API_BASE_URL` | For API calls | The backend's base URL, or a same-origin proxy path, for `src/lib/api.ts`. Development falls back to `http://localhost:3000`. Production has no fallback: a build without it still succeeds, but every API call fails with "The API address is not configured." |

Copy `.env.example` to `.env.local` to set them, and restart Vite after changes. The values ship to the browser, like every `VITE_*` variable.

The backend allows the website's origin through its `WEBSITE_ORIGIN` setting, which defaults to `http://localhost:5174`. A deployed site needs `WEBSITE_ORIGIN` set to its real origin, or the browser blocks its API calls.

## Build and checks

```sh
npm run build
npm run lint
npm test
npm run test:coverage
npm run preview
```

`npm run build` runs `tsc -b` (including the tests and their configuration), then `vite build` into `dist/`. The output is static files with a single `index.html`, so any static host works; serve it over HTTPS.

## Tests

The Vitest suite in `tests/` uses jsdom and React Testing Library. `npm test` runs once; `npm run test:watch` reruns affected tests while editing. Tests cover pricing and Romanian formatting, contact and build configuration, API responses and failures, page structure, and clipboard interactions.

Tests use reserved example addresses, mocked fetch responses, and a simulated clipboard. They require no running backend, mail app, clipboard permission, or local environment configuration. Timeout tests use controlled abort signals instead of real waits. Shared setup restores the DOM, mocks, timers, environment overrides, and clipboard state after each test.

`npm run test:coverage` prints coverage and creates an HTML report at `coverage/index.html`. Coverage includes application TypeScript/TSX, including untested modules, but excludes type declarations and `src/main.tsx`. It is informational: no percentage threshold is enforced. Reports are ignored by Git.

These are logic and component tests, not browser layout tests. Check the page in a browser at 1440, 768, and 390px when changing code, dependencies, or build configuration.

## Content

- Visitor-facing copy, accessibility text, metadata and the email subject are Romanian. Number formatting uses `ro-RO` (for example, `0,5` hours), with explicit Romanian noun forms. The brand and section anchors stay unchanged; there is no language switcher.
- The copy follows `../BUSINESS_PLAN.md`, confirmed rules only. Things the plan lists as still unknown (cities, fleet size, real rates, credit price, cancellation terms) don't appear.
- The pricing example is the plan's §7.2 example. `src/lib/pricing.ts` holds its rows and computes every figure the page shows, in the hero and in the pricing table.
- The visual system is the admin app's, adapted for a page people read; see `DESIGN.md` in this folder.
