# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Read and follow [CLEAN_CODE.md](./CLEAN_CODE.md) when writing or changing code.
It defines the shared JavaScript/TypeScript function conventions; continue
following the package-specific rules as well.

Camioane App is the admin side of a business that sells advertising campaigns on LED-screen trucks running predefined routes. `BUSINESS_PLAN.md` (Romanian) holds the product requirements. So far the code covers authentication, user management with profile pictures, file uploads, a browser-side video editor for uploaded MP4s, a client-side route builder, and an admin dashboard UI that runs on sample data. `mobile/` holds an Expo app for drivers and operators that so far only signs in. `website/` holds the public presentation site for advertisers, a static landing page. Campaigns, credits, and payments are not built yet.


Detailed rules live in `AGENTS.md` (root), `backend/AGENTS.md`, `admin/AGENTS.md`, `mobile/AGENTS.md`, and `website/AGENTS.md`. **Read the AGENTS.md for a package before changing it.** The package READMEs document the API contract, environment variables, and setup. `DESIGN.md` (root) holds the visual system for the frontend and the mobile app (tokens, type, layout, components, and data formatting) and the shared tokens the website copies. `website/DESIGN.md` holds the website's own layout, type sizes and components.

## User workflow preferences (apply everywhere)

- Don't write or modify tests unless the user explicitly asks. Implementing a feature, fixing a bug, or refactoring doesn't count as asking. You can run the existing tests.
- Don't read, search, tail, or retrieve any logs (application, server, container, browser, or system) unless the user explicitly asks.
- Report failed checks, and checks that couldn't run, honestly. Never say tests passed when only build and lint ran.

## Commands

Use Node.js 24+ and npm. Run each command from inside its package.

**backend/** (Express 5 + Prisma 7 + PostgreSQL; Node runs `.ts` directly, so there is no build step)
- First-time setup: `npm ci` (its `postinstall` runs `prisma generate`). If `.env` is missing, copy it from `.env.example`. Startup requires a random `JWT_SECRET` of at least 32 bytes; `backend/README.md` has the command to generate one. Startup also requires FFmpeg's `ffprobe` on `PATH` or at `FFPROBE_PATH`.
- `docker compose up --build -d --wait`: start PostgreSQL only (needs Docker Desktop with Linux containers). The API runs separately.
- Railway API deployment: follow [Deploying to Railway](backend/README.md#deploying-to-railway) for the API Dockerfile and dashboard settings.
- `npm run dev`: start the API watcher and `tsc --watch` together. Type errors don't stop the server, so a successful startup doesn't mean the code type-checks.
- `npm run typecheck`: run after any code change.
- `npm test`: run all `tests/*.test.ts` with `node:test`, one file at a time, against the development database. PostgreSQL (migrated, with an active ADMIN role) must be running and FFmpeg installed. Each test file sets its own random `JWT_SECRET`; fixtures create and delete their own uniquely named users and rows, and uploads go to temporary directories. The unit files (`auth-config`, `config`, `validation`, `storage`, `media`, `app`) never query the database.
- `npm run test:coverage`: the same run with Node's coverage report. It fails below 100% line coverage of `src/` (the generated client is excluded).
- To run one test file: `node --env-file-if-exists=.env --test --experimental-test-module-mocks tests/auth-config.test.ts`. Add `--test-name-pattern="<regex>"` to filter by test name.
- Prisma: `npm run prisma:validate`, `npm run prisma:generate`, `npm run db:migrate -- --name <name> --create-only` (create), `npm run db:migrate` (apply), `npm run db:check`, and `npm run admin:bootstrap` (interactive). `backend/AGENTS.md` has the full schema-change procedure.

**admin/** (React 19, Vite, and TypeScript; there is no test runner)
- `npm run dev`: start Vite on port 5173 with strict port selection. That port matches the backend's default CORS origin.
- `npm run build` (`tsc -b` + `vite build`) and `npm run lint` (Oxlint): run both after any code change. When a browser is available, also check the changed interactions in it.
- `VITE_API_BASE_URL` falls back to `http://localhost:3000` only in dev. Production builds need it set explicitly.
- Railway admin deployment: follow [Deploying to Railway](admin/README.md#deploying-to-railway) for the admin Dockerfile and dashboard settings.

**mobile/** (Expo SDK 58, React Native 0.88, and TypeScript; there is no test runner)
- `npm start`: start Metro; open the app in Expo Go or a simulator. The backend must be running and reachable from the device.
- `npm run typecheck` and `npm run lint` (Oxlint, silent when clean): run both after any code change. Also bundle both platforms with `npx expo export --platform android --platform ios --output-dir <tmp>`. When a device or simulator is available, check the changed interactions there.
- Add Expo and React Native dependencies with `npx expo install` so versions match the SDK. If the Expo API is unreachable, set `EXPO_OFFLINE=1`.
- `EXPO_PUBLIC_API_BASE_URL` falls back to Metro's host on port 3000 only in dev. Release builds need an explicit HTTPS value.

**website/** (React 19, Vite, and TypeScript, set up like `admin/`; there is no test runner)
- `npm run dev`: start Vite on port 5174 with strict port selection, beside the admin app on 5173.
- `npm run build` and `npm run lint` (Oxlint): run both after any code change. The build needs `VITE_CONTACT_EMAIL`; `vite.config.ts` fails without it. Development falls back to `hello@example.com`. When a browser is available, check the page at 1440, 768 and 390px.
- `VITE_API_BASE_URL` falls back to `http://localhost:3000` only in dev, as in the admin app. Builds don't require it, but API calls fail without it.
- Railway website deployment: follow [Deploying to Railway](website/README.md#deploying-to-railway) for the website Dockerfile and dashboard settings.

## Architecture

**Backend request flow:** `src/app.ts` builds the Express app with `createApp()`, which tests also use to spin up servers. Inside `createApp()` the stack runs in this order: CORS restricted to `FRONTEND_ORIGIN` (admin app) and `WEBSITE_ORIGIN` (website), routers, a JSON 404, then the central `error-handler.ts`. Every error is returned as `{ "error": "message" }`. To raise errors, throw `AppError` from `src/lib/app-error.ts`. The code is layered:
- `routes/*.routes.ts` defines routes and attaches middleware to each route. That includes the login rate limiter (in memory, 20 requests per IP per 15 minutes; set `CLIENT_IP_HEADER=x-real-ip` only behind an overwriting proxy such as Railway, leaving `trust proxy` off), `authenticate` and `requireAdmin`, and the 16 KB JSON body parser. There is no global `express.json()`, so a new route that takes a body needs its own parser. The `/users` router also sets `Cache-Control: no-store` on every response; do the same for any new router that returns private data.
- `controllers/` validates input at runtime and shapes HTTP responses.
- `services/` handles Prisma and password work and never touches Express objects. Use the shared client from `src/lib/prisma.ts` (`@prisma/adapter-pg`). Never create a client per request.

`src/server.ts` runs only when the server process starts. It checks database connectivity, starts listening, and disconnects Prisma on shutdown.

**Auth model (spans every package):**
- The backend issues HS256 JWTs that expire after one hour. The `sub` claim holds the immutable user UUID, and a private claim holds a `sessionVersion`.
- On every request, `middleware/authenticate.ts` loads the user and compares that session version with the database. Changing a user's email, password, or role increments the version, which revokes all of that user's tokens.
- Admin CRUD operations run in serializable transactions that are retried on conflict. They enforce two invariants: there must always be at least one admin, and an admin can't delete or demote themselves.
- Password hashing happens outside the transaction.
- Public registration doesn't exist. Admins are created with the local `admin:bootstrap` script.

**Admin:**
- Zustand (`src/auth/session.ts`) owns session state. It persists only the token and its expiry, under `camioane.session.v1`. Every session change goes through `replaceSession`, which does four things:
  - aborts the global request signal
  - clears the TanStack Query cache
  - bumps `revision`
  - syncs other tabs through `storage` events
- TanStack Query owns server data. Don't copy it into Zustand. Never read, migrate, or overwrite the legacy `camioane.users-demo.v1` storage key.
- The root `Layout` in `App.tsx` keys its `<Outlet>` on `revision`, so the whole page tree remounts whenever the session changes.
- `src/lib/api.ts` is the single typed fetch client. It:
  - runtime-decodes every response
  - adds a 15 s timeout
  - discards responses that arrive after a session change
  - signs the user out automatically on a 401
- `Authenticated` (`src/auth/`) checks every session against `GET /users/me` and supplies the user through `UserContext`. Signed-in routes share a pathless layout route so `Authenticated` and `AppShell` stay mounted across navigation; admin-only routes use a nested `admin` layout with `AdminOnly`, which redirects denied access to `/access-denied` inside the shell. The authenticated layout's `onStay` rechecks `/users/me` and admin access in the background on navigation.
- Routes are defined in code with TanStack Router in `App.tsx`. File-based routing is not used.
- Styling is plain CSS. There is no component library.
- TanStack Table is installed but not set up anywhere yet. The Users page uses a plain semantic `<table>`. Before using TanStack Table, check its API against the installed major version (v9).
- The dashboard (`src/pages/DashboardPage/`, admin-only at `/dashboard`) is where `/` sends admins. The backend has no fleet, booking, creative or playback API yet, so it renders `sampleData.ts`, fixed at Wed 4 Nov 2026 14:30. `dashboardData.ts` computes every figure from those rows. Its review, approve, retry and cancel actions only change local React state. When the APIs exist, replace the sample rows with TanStack Query data and keep the computations.
- The Files page (`src/pages/FilesPage/`, admin-only at `/files`) runs on the real `/files` API: list, upload, preview, download and delete. Uploads use the `XMLHttpRequest` path in `src/lib/api.ts` because `fetch` can't report upload progress; it shares `request`'s session, abort and 401 handling. Downloads and previews fetch the file with the bearer token and save or show it through an object URL.
- The video editor (`src/pages/VideoEditorPage/`, admin-only at `/files/$fileId/edit`, opened by Edit on a video row in Files) is lazy-loaded. It cuts one MP4: `edit.ts` holds the segment model, a magnetic list of source ranges with undo history. `@xzdarcy/react-timeline-editor` draws the timeline, and the `<video>` element is the playback clock (`usePlayback.ts`), not the library's engine. The library keeps bar positions in its own state, so `EditTimeline.tsx` versions the action IDs to remount bars after a drop, and keys the Timeline on zoom because its ruler doesn't recompute tick cells. Export renders in the browser with WebCodecs through mediabunny (`renderVideo.ts`, dynamically imported), producing H.264 with AAC, or Opus if AAC can't be encoded. It then uploads the result as a new file through `POST /files`; there is no edit or replace API. With no `GET /files/:id`, `findFile.ts` checks the cached Files pages, then pages through `GET /files`. `UploadProgress` in `src/components/` is shared by Files and the editor.
- Profile pictures: every public user carries `avatar: { url, updatedAt } | null`, and the decoder accepts only the user's own `/users/<id>/avatar` URL. The Profile page (`src/pages/ProfilePage/`, at `/profile` for every role) and the Users edit form (for admins changing anyone's) both use `AvatarEditor` in `src/components/`. It uploads at once through the XHR path with `PUT`, deletes with `DELETE`, then writes the returned user into the `me` query and the admin user list with `replaceCachedUser` (`src/auth/currentUser.ts`). `Avatar` fetches the picture with the bearer token, keyed on `updatedAt`, shows it through an object URL, and falls back to the email's initial.
- Billing details: Profile and the Users edit form share `BillingEditor`, using `GET/PUT/DELETE /users/:id/billing` and `billingKey(revision, userId)`. Company name, CUI, address and billing email save independently of the account; background refresh preserves drafts and Users Save/Cancel confirms before discarding billing edits. Profile also shows read-only account contact, status and activity fields. Billing remains separate from the public user object and is not fetched for table rows.
- The Credits page (`src/pages/CreditsPage/`, admin-only at `/credits`) runs on the real `/credits` API. It leads with every pending purchase, oldest first: `creditsData.ts` pages through `GET /credits/purchases?status=PENDING`, because the API lists newest first, 100 at a time. Admins confirm (with an optional payment reference), mark failed or cancel each one in a review dialog, and adjust balances by hand. The ledger and purchase history page by 50 and filter by account; there is no endpoint listing every account's balance, so a balance shows only for the account picked. All its queries sit under `['credits', revision]`, which each action invalidates.
- The route builder (`src/pages/RouteBuilderPage/`, admin-only at `/routes`) is lazy-loaded. It uses MapLibre GL with the Directions plugin and a public OSRM demo endpoint, configured through `VITE_MAP_STYLE_URL` and `VITE_ROUTING_API_URL`. Routes exist only on the client: there is no save API yet, and routing doesn't account for truck-specific restrictions.

- Van-screen video (`admin/src/pages/ScreenVideoPage/`, admin-only at `/screen` and `/files/$fileId/screen`) previews and converts a local or stored MP4 into three copies on an editable canvas. Shared admin presets (`/screen-presets`) persist canvas dimensions, three regions and their framing, with version conflicts preserving local edits. `screenLayout.ts` holds the unconfirmed ViPlex Version A fallback (2304 × 512, all contain) and placement maths shared by preview and rendering; both consume the same layout. Conversion snapshots the layout/preset name and includes the name in the exported filename. Mobile doesn't use these presets: each phone saves its own output resolutions and scales the Version A regions to them (`mobile/src/features/screen/`). The browser uploads only the converted result as a new file; the original is unchanged. `RenderProgress` is shared with the editor from `src/components/`.
- Display playback (`admin/src/pages/DisplayPage/`, `/display` and `/files/$fileId/display`) is available to every signed-in role. A same-origin popup renders a React portal for muted, looping test-video or ordered-playlist playback, with two video elements for preloading, fullscreen controls, wake lock, live X/Y/scale and a calibration grid. IndexedDB keeps playlist manifests and video blobs per account in atomic transactions; placement lives in browser-wide localStorage. Leaving or changing sessions closes playback but keeps playlists. Files and successful screen conversions offer “Redă pe ecran”. Screen selection uses Window Management when available, otherwise users move the popup manually; HDMI mode selection belongs to the OS.

**Mobile (`mobile/`):**
- It is for the `DRIVER` and `OPERATOR` roles. `appRoles` in `src/lib/user.ts` decides this; other roles see an explanation and a sign-out button.
- `src/auth/session.ts` and `src/lib/api.ts` port the web client's session store and fetch client: same runtime decoding, 15 s timeout, stale-response drop and 401 sign-out. The token and its expiry persist in `expo-secure-store` under `camioane.session.v1`, and writes are chained so they land in order.
- Expo Router reads routes from `src/app/`. The root `_layout.tsx` holds the splash screen until fonts and the saved session load, then uses `Stack.Protected` to choose between `(app)` and `sign-in`. `(app)/_layout.tsx` checks `GET /users/me`, applies the role gate, and is keyed on `revision`.
- TanStack Query's `focusManager` follows `AppState`, so returning to the foreground rechecks the session.
- `/playlist` provides persistent per-user HDMI MP4 playlists from phone imports and
  the existing Files API. `mobile/src/features/playlist/` owns metadata and videos
  under `Paths.document/hdmi-playlist/<userId>/`. Edits re-prepare and require Play;
  files are removed only after native readers detach. Both platforms enforce
  session expiry. iOS loops an AVQueuePlayer in background; Android 11+ uses a
  display window context and a mediaPlayback foreground service. Android lock
  behaviour needs hardware verification; dim the phone instead if HDMI blanks.
  Rebuild the development app after native changes.
- HDMI test and playlist share per-phone X/Y/scale in `mobile/src/features/hdmi-placement/`.
  Default is 1:1 at the top-left, cropping outside the negotiated HDMI frame. The test
  provides live offsets/scale, offered modes, crop warnings and a fixed native calibration
  grid. Apply saved placement after native start, before prepare; preserve editor canvas
  geometry and uploaded files. The grid is session-only and clears on Stop/error/expiry.
- The home screen shows that route and shift assignments aren't available yet; there is no API for them.
- `ios/` and `android/` are generated by `expo prebuild` or EAS, and Git ignores them.

**Website (`website/`):**
- One English landing page with anchored sections in `src/sections/`; no router or data libraries. `src/lib/api.ts` is a typed fetch client for the backend (no session or token); no section calls it yet. It's a separate package: copy what it needs from `admin/`, never import across packages.
- The only call to action is a `mailto:` link built from `VITE_CONTACT_EMAIL` in `src/lib/contact.ts`. There is no contact or lead API.
- Copy follows the confirmed rules in `BUSINESS_PLAN.md`. Don't invent cities, fleet sizes, rates, prices or clients. The pricing example (the plan's §7.2) lives in `src/lib/pricing.ts`, which computes every figure the hero and the pricing table show.

When you change a backend response contract, also update its consumers in `admin/src/lib/` and `mobile/src/lib/` and document the change in `backend/README.md`. Don't invent endpoints the backend doesn't have.

## Conventions and gotchas

- All packages use two-space indentation, single quotes, `import type`, and relative imports only. The backend uses semicolons and explicit `.ts` extensions in imports. The frontend, mobile and website packages omit semicolons.
- All packages enable `erasableSyntaxOnly`, so avoid enums and parameter properties. Don't weaken compiler checks to make code compile.
- Put a component used by only one page in `src/pages/<Page>/components/`. Move it to `src/components/` only once a second page actually uses it.
- Don't edit or commit `backend/src/generated/prisma/`; it's generated. After schema changes, create a named migration with `--create-only`, review the SQL, apply it, then explicitly run `prisma:generate` and `typecheck`. Never use `prisma db push`, `migrate reset`, or `docker compose down -v`, and never truncate tables. Deployments apply committed migrations with `npx prisma migrate deploy`, never `migrate dev`.
- Never overwrite existing `.env` files. Frontend and website `VITE_*` and mobile `EXPO_PUBLIC_*` values are public.
- Backend test helpers live in `tests/helpers/` (environment, test server, fixtures, temporary storage, Prisma transaction fakes, subprocesses); MP4 samples and `--import` preloads live in `tests/fixtures/`. To reach a branch the shared database must not be put in (a single administrator, an expired ADMIN role, a storage failure), use those seams; never change shared roles or real accounts.
- `hardware_docs/` holds the NovaStar TB60 controller documentation (vendor manuals, NovaCloud API snapshots, short developer notes in `developer/`) and photos of the truck's screens in `evidence/`. Start with `hardware_docs/Phone-HDMI-Playback.md` for screen sizes, the canvas layout and HDMI test findings; it marks which values are measured and which are inferred. Keep the vendor files unchanged.
- Commit messages use `feat:` or `fix:` followed by an imperative description. Commit lockfiles together with their manifests.
