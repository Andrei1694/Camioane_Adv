# Camioane App website

The public presentation site for advertisers: one English landing page that explains what a campaign books (routes, slots, cars, dates), how a campaign runs, pricing in credits per car-hour with a worked example, the all-or-nothing confirmation, and how creatives reach the screens. Its call to action is a `mailto:` link.

It is a static React, TypeScript and Vite app, set up like `../frontend/`, with plain CSS and IBM Plex Sans self-hosted through `@fontsource`. It calls no API and has no router, state or data libraries.

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
| `VITE_CONTACT_EMAIL` | For builds | The address behind "Plan a campaign" and "Email us", and shown as text in the contact section. `vite build` fails when it's missing or not an address. Development falls back to `hello@example.com`. |

Copy `.env.example` to `.env.local` to set it, and restart Vite after changes. The value ships to the browser, like every `VITE_*` variable.

## Build and checks

```sh
npm run build
npm run lint
npm run preview
```

`npm run build` runs `tsc -b`, then `vite build` into `dist/`. There is no test runner. The output is static files with a single `index.html`, so any static host works; serve it over HTTPS.

## Content

- The copy follows `../BUSINESS_PLAN.md`, confirmed rules only. Things the plan lists as still unknown (cities, fleet size, real rates, credit price, cancellation terms) don't appear.
- The pricing example is the plan's §7.2 example. `src/lib/pricing.ts` holds its rows and computes every figure the page shows, in the hero and in the pricing table.
- The visual system is the admin app's, adapted for a page people read; see `DESIGN.md` in this folder.
