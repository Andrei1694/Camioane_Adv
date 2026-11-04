# Repository Guidelines

## Project Structure & Module Organization

- `frontend/`: React/TypeScript/Vite dashboard. Pages: `src/pages/<PageName>/`; shared components: `src/components/`; authentication: `src/auth/`; API helpers: `src/lib/`; assets: `src/assets/` and `public/`.
- `backend/`: Express/TypeScript API organized into routes, controllers, services, and middleware under `src/`. Prisma schema/migrations live in `prisma/`; tests in `tests/`.
- `mobile/` and `hardware_docs/` are placeholders.
- Follow directory-specific instructions in `frontend/AGENTS.md` and `backend/AGENTS.md`.

## Build, Test, and Development Commands

Use Node.js 24+ and npm inside each package.

| Directory | Command | Purpose |
| --- | --- | --- |
| Either package | `npm ci` | Install locked dependencies |
| `backend/` | `docker compose up --build -d --wait` | Start PostgreSQL only |
| `backend/` | `npm run dev` | Run API and continuous type checking |
| `backend/` | `npm run typecheck` | Check TypeScript |
| `backend/` | `npm test` | Run Node tests |
| `frontend/` | `npm run dev` | Start Vite on port 5173 |
| `frontend/` | `npm run build` | Type-check and produce `dist/` |
| `frontend/` | `npm run lint` | Run Oxlint |
| `frontend/` | `npm run preview` | Preview the production build |

Follow `backend/README.md` for setup, migrations, and administrator bootstrap. The backend executes TypeScript directly without compilation.

## Coding Style & Naming Conventions

Use two-space indentation, single quotes, and type-only imports. Backend code uses semicolons and explicit `.ts` relative imports; frontend code omits semicolons. Use PascalCase component filenames (`UserForm.tsx`), camelCase functions, and backend names like `user.service.ts`. Keep page-specific components beside their page. Frontend linting uses Oxlint; no formatter is configured.

## Testing Guidelines

Backend tests use `node:test`, `node:assert/strict`, and `tests/*.test.ts`. Integration tests require development PostgreSQL and isolated fixtures. Legacy tests expect obsolete registration/JWT contracts; report failures honestly. No coverage threshold or frontend test runner is configured. Verify frontend changes with build, lint, and browser interaction checks. Write or modify tests only when explicitly requested; inspect logs only when explicitly requested.

## Commit & Pull Request Guidelines

Recent commits use `feat:` and `fix:` with imperative descriptions. PRs should describe changes, link issues, list verification results, and include UI screenshots. Document API/configuration changes; commit lockfiles alongside manifests.

## Security & Configuration

Preserve existing environment files; never commit secrets. Frontend `VITE_*` values are public. Commit reviewed Prisma migrations with schema changes, regenerate the client, and preserve database volumes. Keep generated clients and build output untracked.
