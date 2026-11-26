# Repository Guidelines

Read and follow [CLEAN_CODE.md](./CLEAN_CODE.md) when writing or changing code.
It defines the shared JavaScript/TypeScript function conventions; continue
following the package-specific rules as well.

## Project Structure & Module Organization

- `admin/`: React/TypeScript/Vite dashboard. Pages: `src/pages/<PageName>/`; shared components: `src/components/`; authentication: `src/auth/`; API helpers: `src/lib/`; assets: `src/assets/` and `public/`.
- `backend/`: Express/TypeScript API organized into routes, controllers, services, and middleware under `src/`. Prisma schema/migrations live in `prisma/`; tests in `tests/`.
- `mobile/`: Expo (React Native) app for drivers and operators. Expo Router routes: `src/app/`; session: `src/auth/`; API client, theme and shared types: `src/lib/`; shared components: `src/components/`. Native `ios/` and `android/` folders are generated, not committed.
- `website/`: React/TypeScript/Vite presentation site for advertisers, one static landing page. Sections: `src/sections/`; shared pieces: `src/components/`; formatting, pricing example, contact link and API client: `src/lib/`.
- `hardware_docs/`: NovaStar TB60 controller documentation (vendor manuals, NovaCloud API snapshots, developer notes in `developer/`) and photos of the truck's screens in `evidence/`. `Phone-HDMI-Playback.md` records the screen sizes, canvas layout and HDMI test findings.
- Follow directory-specific instructions in `admin/AGENTS.md`, `backend/AGENTS.md`, `mobile/AGENTS.md`, and `website/AGENTS.md`.

## Build, Test, and Development Commands

Use Node.js 24+ and npm inside each package.

| Directory | Command | Purpose |
| --- | --- | --- |
| Any package | `npm ci` | Install locked dependencies |
| `backend/` | `docker compose up --build -d --wait` | Start PostgreSQL only |
| `backend/` | `npm run dev` | Run API and continuous type checking |
| `backend/` | `npm run typecheck` | Check TypeScript |
| `backend/` | `npm test` | Run Node tests |
| `backend/` | `npm run test:coverage` | Run Node tests with the 100% line coverage gate |
| `admin/` | `npm run dev` | Start Vite on port 5173 |
| `admin/` | `npm run build` | Type-check and produce `dist/` |
| `admin/` | `npm run lint` | Run Oxlint |
| `admin/` | `npm run preview` | Preview the production build |
| `mobile/` | `npm start` | Start Metro for Expo Go or a development build |
| `mobile/` | `npm run build:ios -- --device` | Build, sign, and install the development app on a physical iPhone |
| `mobile/` | `npm run typecheck` | Check TypeScript |
| `mobile/` | `npm run lint` | Run Oxlint |
| `website/` | `npm run dev` | Start Vite on port 5174 |
| `website/` | `npm run build` | Type-check and produce `dist/` (needs `VITE_CONTACT_EMAIL`) |
| `website/` | `npm run lint` | Run Oxlint |

Follow `backend/README.md` for setup, migrations, and administrator bootstrap. The backend executes TypeScript directly without compilation.

### Build and install on an iPhone

The HDMI player requires the app's own development build; Expo Go cannot load it.
Use macOS with Xcode 27+, CocoaPods, Node.js 24+, and dependencies installed in
`mobile/`. Add your Apple account to Xcode and make sure a development signing
certificate is available. Connect the iPhone by USB, unlock it, trust the Mac,
and enable **Settings → Privacy & Security → Developer Mode**, completing any
restart prompts.

From the repository root:

```sh
cd mobile
node --version
npm run build:ios -- --device
```

Select the physical iPhone, not a simulator. The command builds and signs the
app, installs **Camioane Driver**, and starts Metro. For scripted installs,
discover the current device with `xcrun devicectl list devices` and pass its
identifier after `--device`; do not hardcode a developer's device identifier.
Check signing identities with `security find-identity -v -p codesigning` if
signing fails.

If Metro needs to run separately, start it from `mobile/` in one terminal:

```sh
npx expo start --dev-client --lan --port 8081
```

Then build/install from `mobile/` in another terminal:

```sh
npm run build:ios -- --device --no-bundler
```

Do not combine `--port` with `--no-bundler`; Expo rejects that combination.
Check for an existing server before starting one and preserve unrelated servers.
Keep Metro running and the Mac and iPhone on the same local network. Allow the
app's local-network access prompt. If server discovery fails, use **Enter URL
manually** in the installed app with `http://<Mac-LAN-IP>:8081`; no Expo account
login is needed. A server bound with `--localhost` is unsuitable for a physical
phone. Likewise, `EXPO_PUBLIC_API_BASE_URL` must use an address reachable from
the phone, not `localhost`; without an override, development uses Metro's host
on API port 3000. Preserve existing environment files.

If installation succeeds but launch reports **Untrusted Developer**, ask the
user to open **Settings → General → VPN & Device Management**, select their
**Apple Development** profile, and trust it, completing any restart prompts.
Then relaunch the installed app; this does not require another build. Verify
installation with `xcrun devicectl device info apps --device "<device-id>"
--bundle-id com.camioane.driver` and confirm the app actually opens on the phone
before reporting launch success. Do not inspect device or Metro logs unless
requested.

The `admin` / `admin` offline sign-in opens a local Operator preview without a
backend session, in development and Release builds alike. It can open the HDMI test, but physical playback still
requires a compatible adapter and display. Rebuild after native dependency or
native code changes; JavaScript-only changes use the running Metro server.
Keep generated `mobile/ios/` and `mobile/android/` folders untracked and configure
native changes through Expo config and local modules. See `mobile/AGENTS.md`
and `mobile/README.md` for the full mobile workflow.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and type-only imports. Backend code uses semicolons and explicit `.ts` relative imports; frontend, mobile and website code omit semicolons. Use PascalCase component filenames (`UserForm.tsx`), camelCase functions, and backend names like `user.service.ts`. Keep page-specific components beside their page. Frontend and mobile linting use Oxlint; no formatter is configured.

## Testing Guidelines

Backend tests use `node:test`, `node:assert/strict`, and `tests/*.test.ts`, with shared helpers in `tests/helpers/`. They cover every backend module: unit tests for configuration, validation, storage and media, integration tests for the users, profile picture, file and credit APIs, and subprocess tests for startup, shutdown and the scripts. Integration tests require migrated development PostgreSQL, built-in roles with an active ADMIN role, FFmpeg, and isolated fixtures. `npm run test:coverage` enforces 100% line coverage of `backend/src/`. No frontend, mobile or website test runner is configured. Verify frontend changes with build, lint, and browser interaction checks. Verify mobile changes with typecheck, lint, a Metro bundle (`npx expo export`), and device or simulator checks when one is available. Write or modify tests only when explicitly requested; inspect logs only when explicitly requested.

## Commit & Pull Request Guidelines

Recent commits use `feat:` and `fix:` with imperative descriptions. PRs should describe changes, link issues, list verification results, and include UI screenshots. Document API/configuration changes; commit lockfiles alongside manifests.

## Security & Configuration

Preserve existing environment files; never commit secrets. Frontend and website `VITE_*` values are public. Commit reviewed Prisma migrations with schema changes, regenerate the client, and preserve database volumes. Keep generated clients and build output untracked.
