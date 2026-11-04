# Backend agent guidance

These instructions apply to `backend/` and its descendants. Keep backend work
scoped here unless the requested feature also requires changes elsewhere.

## Project context

- This is the Camioane App API, built with Express 5, TypeScript ES modules,
  Prisma 7, and PostgreSQL. Use Node.js 24 or newer.
- Use npm. Keep `package.json` and `package-lock.json` in sync when dependencies
  change; those files are authoritative for installed versions.
- Node.js runs the `.ts` source directly. There is no compilation or build step.
- `cors`, `express-rate-limit`, and `pino` are installed but are not currently
  configured. Check the source before assuming middleware or logging exists.
- The Prisma schema defines `User` with `email` as the primary key and `password`
  for a password hash. Its initial migration lives in `prisma/migrations/`.
  Hash passwords before persisting them; Prisma does not hash automatically.
- The browser frontend lives in `../frontend/`. Check its API consumers when
  changing response contracts, and document new endpoints in `README.md`.

## Commands

Run these commands from `backend/`:

| Command | Purpose |
| --- | --- |
| `npm ci` | Install locked dependencies and generate Prisma Client via `postinstall` |
| `npm install <package>` | Add a runtime dependency and update the lockfile |
| `npm install -D <package>` | Add development tooling and update the lockfile |
| `docker compose up --build -d --wait` | Build and start the local PostgreSQL container, waiting for readiness |
| `npm run dev` | Run the server with restart watching and continuous type checking |
| `npm run dev:server` | Run the server with restart watching only |
| `npm run typecheck` | Check TypeScript once without emitting files |
| `npm run typecheck:watch` | Check TypeScript continuously |
| `npm start` | Run the server without watching or type checking |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run prisma:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:check` | Verify database connectivity with a read-only query |
| `npm run db:migrate -- --name <name>` | Create and apply a migration to the development database |
| `npm run db:studio` | Open Prisma Studio |
| `docker compose down` | Stop and remove the local container while retaining its data volume |

For a fresh checkout, copy `.env.example` to `.env` if it does not already exist.
Start Docker Desktop with Linux containers enabled before starting PostgreSQL.
The Compose service runs the database only; start the API separately with npm.

There are currently no build, lint, or test scripts. Do not report automated tests
as passing when only type checking or manual checks were performed.

## Code conventions and API structure

- Match surrounding formatting: two-space indentation, single quotes, and
  semicolons. Use TypeScript and ES module imports rather than CommonJS.
- Use `.ts` extensions in relative imports and `import type` for type-only
  imports. No path aliases are configured.
- Follow the strict TypeScript configuration and `erasableSyntaxOnly`. Avoid
  syntax that requires transpilation, such as enums and parameter properties.
  Do not weaken compiler checks to make a change compile.
- Type function inputs and API boundaries; let TypeScript infer straightforward
  local values and return types. Avoid `any` and unnecessary type assertions.
- `src/app.ts` defines and exports the Express application without listening on a
  port. Keep route and middleware setup here or in modules imported by it.
- `src/server.ts` validates the port, verifies database connectivity, starts the
  HTTP server, and handles shutdown. Preserve startup failure handling and Prisma
  disconnection on shutdown.
- Register new routes before the final JSON 404 handler. Keep responses JSON and
  use appropriate HTTP status codes. Current endpoints are `GET /` (API name) and
  `GET /health` (`{ "status": "ok" }`); the health route does not query the database.
- Validate incoming bodies, route parameters, and query parameters at runtime.
  TypeScript annotations do not validate external input. Keep internal errors and
  credentials out of API responses and logs.
- Add folders and abstractions as features need them. Reuse installed libraries
  when suitable instead of introducing overlapping dependencies.

## Database and configuration

- Reuse the shared client exported by `src/lib/prisma.ts`; do not create a Prisma
  client per request. It uses `@prisma/adapter-pg` and requires `DATABASE_URL`.
- Define models in `prisma/schema.prisma`. CLI configuration and the datasource
  URL live in `prisma.config.ts`, which loads `.env` with Node's environment loader.
- After model changes, create a named development migration and regenerate the
  client. Commit the schema and migration files under `prisma/migrations/`.
- Do not edit or commit `src/generated/prisma/`. It is generated and ignored,
  along with `node_modules/`, local environment files, logs, and coverage output.
- Use Prisma queries or parameterized raw queries; never concatenate external
  input into SQL. Keep the connectivity script read-only.
- Keep `.env.example` and `README.md` aligned with configuration changes. Never
  overwrite an existing `.env` during setup or commit real credentials. Existing
  environment variables take precedence over `.env`.
- Keep `DATABASE_URL` aligned with the local `POSTGRES_*` settings. PostgreSQL is
  exposed on localhost, and Compose stores its data in a named volume. Changing
  initial credentials in `.env` does not update an already initialized database.
- Preserve database data during routine development. `docker compose down -v`
  deletes the volume; do not use it or Prisma reset commands as routine fixes.
  Use migrations only against the intended development database.

## Verification

- After application code, dependency, or TypeScript configuration changes, run
  `npm run typecheck`. Development mode reports type errors but does not prevent
  the server from running, so startup alone is not a type check.
- For Prisma changes, run `npm run prisma:validate` and
  `npm run prisma:generate` before type checking. Use `npm run db:check` when
  database configuration or connectivity changes and a database is available.
- For API changes, exercise the affected endpoints and relevant invalid-input
  and not-found cases. For server lifecycle changes, also check startup and clean
  shutdown. Report failed checks or checks that could not run.
- For documentation-only changes, review accuracy and check whitespace;
  application startup and database changes are unnecessary.
- If a test runner is introduced, document its commands here and add tests for
  meaningful behavior. Keep this file aligned with the actual project setup.
