# Camioane App website

The public presentation site for advertisers: one Romanian landing page that explains what a campaign books (routes, slots, cars, dates), how a campaign runs, pricing in credits per car-hour with a worked example, the all-or-nothing confirmation, and how creatives reach the screens. Its call to action is a `mailto:` link.

It is a React, TypeScript and Vite app served as static files, with plain CSS and IBM Plex Sans self-hosted through `@fontsource`. TanStack Router handles `/`, `/login`, `/account`, and `/demo-map-hero`; TanStack Query handles login and verified account data; Zustand holds the session. The public landing page makes no API requests and works without a running backend.

`/demo-map-hero` is an intentionally empty, separate page named “Demo Map Hero”.
It renders no header, footer, map or other content. Open it from the landing
page's desktop navigation or the shared footer link.

## Sign-in and account

“Contul meu” opens the account page, redirecting signed-out visitors to login.
Use an existing administrator-created account. All active roles (`USER`, `ADMIN`,
`OPERATOR`, `DRIVER`) can view their own name, email, phone and role and sign out.
There is no registration, password reset, profile editing, avatar management,
credits, files or campaign booking in the website.

Login calls `POST /users/login`; account verification calls `GET /users/me` with
the bearer token. The client validates both responses. No details are displayed
until the server verifies the session. Verification runs again on account entry,
focus and reconnection. Network failures offer retry; expired or revoked sessions
return to login. Login requests are never retried automatically.

Only the token and expiration persist in `localStorage` under
`camioane.website.session.v1`, separate from admin. User details stay in Query's
memory cache; passwords stay transient. Sign-in, logout and cross-tab changes
abort pending requests, discard cached account data, and prevent old responses
from restoring an earlier session. When storage is unavailable, the session works
in memory and a notice explains that reloading may require another sign-in.

The pages use Romanian feedback and the existing visual system. Missing account
fields display “Necompletat”. Contact links and the landing page remain available
if authentication is unavailable.

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
| `VITE_API_BASE_URL` | For sign-in and account | The backend's base URL, or a configured same-origin proxy path, for `src/lib/api.ts`. Development falls back to `http://localhost:3000`. Production has no fallback: the build and landing page work without it, but account routes display an authentication-unavailable message. |

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

`npm run build` runs `tsc -b` (including the tests and their configuration), then `vite build` into `dist/`. The output is static files with a single `index.html`; see [Deploying to Railway](#deploying-to-railway) for production hosting over HTTPS.

## Deploying to Railway

Deploy the website as a third service from the same repository, alongside the
[API service](../backend/README.md#deploying-to-railway) and
[admin service](../admin/README.md#deploying-to-railway). Configure it in Railway's
dashboard using the automatically detected `Dockerfile`; no `railway.toml` is
needed. [Config as Code is deprecated](https://docs.railway.com/config-as-code)
and unavailable to new services.

Add a GitHub service from `Andrei1694/Camioane_Adv` and configure:

| Setting | Value | Reason |
| --- | --- | --- |
| Root Directory | `website` | Railway automatically builds the website `Dockerfile` in this directory |
| Watch Paths | `/website/**` | Only website changes trigger a website deployment |
| Healthcheck Path | `/` | Wait for HTTP 200 on the service's `PORT` before accepting the deployment |
| Restart Policy | On Failure | Restart Caddy if its process exits with an error |
| Pre-deploy Command | None | The website has no migrations or runtime setup |
| Volume | None | All served files are built into the image; the service is stateless |

Leave Build and Start Command overrides unset; the Dockerfile supplies both.
Multiple replicas are supported. The image defaults to `PORT=8080`; use **8080**
for the public domain's target port, or match `PORT` if you override it.

Set these service variables in the dashboard before building:

| Variable | Value and reason |
| --- | --- |
| `VITE_CONTACT_EMAIL` | Required: the address visitors should contact, for example `contact@example.com`. The existing Vite configuration rejects missing or invalid addresses |
| `VITE_API_BASE_URL` (required for sign-in) | `https://${{<api service>.RAILWAY_PUBLIC_DOMAIN}}`, replacing `<api service>` with the API service name (for example, `backend`). It may remain unset for a landing-only deployment. When set, the Dockerfile requires it to start with `https://`; there is no same-origin proxy |

All `VITE_*` values are public and baked into the JavaScript at build time; never
put secrets in them. Applying variable changes in Railway triggers a new build
and deployment; restarting an existing image cannot change its contact address
or API URL.
[Railway requires build variables to be declared as `ARG`s](https://docs.railway.com/builds/dockerfiles#using-variables-at-build-time),
so keep new `VITE_*` variables declared in the Dockerfile's build stage.
Local `.env` files are excluded from the image.

Deploy in this order:

1. Add the website service, apply the settings and variables above, and deploy it.
   If setting `VITE_API_BASE_URL`, first generate the API service's public domain
   as described in the [API guide](../backend/README.md#deploying-to-railway).
2. Generate the website service's Railway domain with target port **8080**.
   Railway's edge provides HTTPS; Caddy serves HTTP inside the container.
3. Set the API service's `WEBSITE_ORIGIN` to
   `https://${{<website service>.RAILWAY_PUBLIC_DOMAIN}}`, replacing
   `<website service>` with the website service name (for example, `website`).
   Apply the change to redeploy the API so CORS allows the website origin. For a
   custom website domain, use that exact HTTPS origin instead, without a trailing
   slash.
4. Open the website HTTPS URL and confirm the contact links use the configured
   email address.

The multi-stage image builds with Node.js 24 and all locked dependencies,
including the development dependencies needed to type-check `tests/` through
`tsconfig.test.json`. Its runtime uses Caddy as a non-root user to serve only
`dist/`, with gzip and Zstandard compression. `/login`, `/account`, `/demo-map-hero`, and their
trailing-slash variants explicitly serve `index.html` so direct loads and refreshes
work. `/index.html` redirects in the browser to `/`, preserving its hash. There
is no catch-all SPA fallback: unknown paths such as `/pricing` and missing assets
return a plain 404. Landing navigation keeps section anchors such as `/#pricing`.
HTML and other non-hashed files use `Cache-Control: no-cache`;
existing hashed `/assets/*` files are immutable for one year.

For a local container check, run from `website/`:

```sh
docker build --build-arg VITE_CONTACT_EMAIL=contact@example.com -t camioane-website .
docker run --rm -p 8080:8080 camioane-website
```

Open `http://localhost:8080` and confirm the call to action uses
`mailto:contact@example.com`. This check needs no API. Stop the container with
Ctrl+C when finished.

## Tests

The Vitest suite in `tests/` uses jsdom and React Testing Library. `npm test` runs once; `npm run test:watch` reruns affected tests while editing. Tests cover pricing and Romanian formatting, contact and build configuration, API responses and failures, page structure, and clipboard interactions.

Tests use reserved example addresses, mocked fetch responses, and a simulated clipboard. They require no running backend, mail app, clipboard permission, or local environment configuration. Timeout tests use controlled abort signals instead of real waits. Shared setup restores the DOM, mocks, timers, environment overrides, and clipboard state after each test.

`npm run test:coverage` prints coverage and creates an HTML report at `coverage/index.html`. Coverage includes application TypeScript/TSX, including untested modules, but excludes type declarations and `src/main.tsx`. It is informational: no percentage threshold is enforced. Reports are ignored by Git.

These are logic and component tests, not browser layout tests. Check the page in a browser at 1440, 768, and 390px when changing code, dependencies, or build configuration.

The existing suite covers the landing page and public health client; it does not
provide automated coverage for the new authentication flow. Check login errors,
successful login with an existing account, account loading/retry, reload,
expiration, logout, cross-tab changes and Back navigation in a browser. Also
verify direct account-route loads and missing-asset 404s with the production
Caddy configuration. Do not add or modify tests unless explicitly requested.

## Content

- Visitor-facing copy, accessibility text, metadata and the email subject are Romanian. Number formatting uses `ro-RO` (for example, `0,5` hours), with explicit Romanian noun forms. The brand and section anchors stay unchanged; there is no language switcher.
- The copy follows `../BUSINESS_PLAN.md`, confirmed rules only. Things the plan lists as still unknown (cities, fleet size, real rates, credit price, cancellation terms) don't appear.
- The pricing example is the plan's §7.2 example. `src/lib/pricing.ts` holds its rows and computes every figure the page shows, in the hero and in the pricing table.
- The visual system is the admin app's, adapted for a page people read; see `DESIGN.md` in this folder.
