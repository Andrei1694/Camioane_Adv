# Backend agent guidance

These instructions apply to `backend/` and its descendants. Keep backend work
scoped here unless the requested feature also requires changes elsewhere.

## User workflow preferences

- Do not write new tests or modify existing tests unless the user explicitly
  requests it. Feature implementation, bug fixes, and refactors do not imply a
  request to write tests. Existing tests may still be run for verification.
- Do not read, inspect, search, tail, or retrieve logs unless the user explicitly
  requests it. This includes application, server, container, and system logs.

## Project context

- This is the Camioane App API, built with Express 5, TypeScript ES modules,
  Prisma 7, and PostgreSQL. Use Node.js 24 or newer.
- Use npm. Keep `package.json` and `package-lock.json` in sync when dependencies
  change; those files are authoritative for installed versions.
- Node.js runs the `.ts` source directly. There is no compilation or build step.
- CORS permits `FRONTEND_ORIGIN`; login has an in-memory
  limit of 20 requests per IP per 15 minutes. `pino` is not configured.
- User authentication uses Argon2id password hashes and one-hour HS256 JWT
  bearer tokens. Require a random `JWT_SECRET` of at least 32 bytes at startup.
- The Prisma schema defines `User` with an immutable UUID primary key, unique
  email, password hash, required `roleId` relation, and private session version.
  Shared `Role` records have UUID IDs, unique `RoleName` enum names, `startDate`,
  nullable `endDate`, and `activ`. Names are ADMIN, OPERATOR, DRIVER, and USER.
  Only ADMIN grants administrator access; other roles currently have profile access.
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
| `npm test` | Run Node integration tests against the configured PostgreSQL database |
| `npm start` | Run the server without watching or type checking |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run prisma:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:check` | Verify database connectivity with a read-only query |
| `npm run db:migrate -- --name <name>` | Create and apply a migration to the development database |
| `npm run db:studio` | Open Prisma Studio |
| `npm run admin:bootstrap` | Interactively create or explicitly promote an administrator |
| `docker compose down` | Stop and remove the local container while retaining its data volume |

For a fresh checkout, copy `.env.example` to `.env` if it does not already exist.
Generate a local `JWT_SECRET` using the command in `README.md` before starting
the API; preserve all existing `.env` settings.
Start Docker Desktop with Linux containers enabled before starting PostgreSQL.
The Compose service runs the database only; start the API separately with npm.

There are no build or lint scripts. Tests use Node's built-in runner, native
`fetch`, and uniquely named database users with targeted cleanup. They generate
an ephemeral JWT secret without changing `.env`. Run them against a development
database only; they insert and delete their own fixture users.

## Code conventions and API structure

- Match surrounding formatting: two-space indentation, single quotes, and
  semicolons. Use TypeScript and ES module imports rather than CommonJS.
- Use `.ts` extensions in relative imports and `import type` for type-only
  imports. No path aliases are configured.
- Follow the strict TypeScript configuration and `erasableSyntaxOnly`. Avoid
  syntax that requires transpilation, such as TypeScript enums and parameter properties.
  Prisma schema enums are supported; use their generated types and runtime constants.
  Do not weaken compiler checks to make a change compile.
- Type function inputs and API boundaries; let TypeScript infer straightforward
  local values and return types. Avoid `any` and unnecessary type assertions.
- `src/app.ts` defines and exports the Express application without listening on a
  port, and exports `createApp()` for isolated test servers. Keep route and
  middleware setup here or in modules imported by it.
- User routes live in `src/routes/user.routes.ts`, HTTP validation and responses
  in `src/controllers/user.controller.ts`, and Prisma/password operations in
  `src/services/user.service.ts`. Keep Express objects out of services.
- Reuse `src/middleware/authenticate.ts` for protected routes. It verifies JWT
  claims and checks that the user and session version still match. Public users contain id, email, role,
  and avatar (`null` or `{ url, updatedAt }`); never expose password hashes or storage keys. Return errors as `{ "error": "message" }` through
  the centralized error handler.
- `src/server.ts` validates the port, verifies database connectivity, starts the
  HTTP server, and handles shutdown. Preserve startup failure handling and Prisma
  disconnection on shutdown.
- Register new routes before the final JSON 404 handler. Keep responses JSON and
  use appropriate HTTP status codes, except for streamed file downloads. Endpoints are `GET /` (API name),
  `GET /health` (`{ "status": "ok" }`), `POST /users/login`, protected
  `GET /users/me`, admin-only GET/POST `/users` and PATCH/DELETE `/users/:id`,
  GET/PUT/DELETE `/users/:id/avatar` for the user or an active admin,
  the `/files` routes, the `/credits` routes, and the admin-only `/config` routes
  listed in `README.md`.
  Public registration is removed. The health route does not query the database.
- CRUD services recheck the actor and administrator invariants in serializable
  transactions with bounded conflict retries. Keep password hashing outside those
  transactions. Email/password/role changes increment the session version.
- Administrator access also requires the shared ADMIN role to satisfy
  `activ && startDate <= now && (endDate === null || now < endDate)`.
  Reuse `src/lib/role.ts` in middleware and transactional service checks.
  Role validity never blocks login/profile access or role assignment; shared
  lifecycle changes do not revoke sessions. Reactivation restores admin access
  for otherwise valid sessions. Keep role IDs/dates out of public user responses.
  Treat changes from ADMIN to any other role as demotions for administrator safety.
- Bootstrap is a local interactive command, never an HTTP endpoint. Preserve hidden
  password entry and explicit confirmation before promoting an existing account.
  Resolve the shared ADMIN record and reject a missing or unavailable role;
  never silently create or reactivate it.
- Validate incoming bodies, route parameters, and query parameters at runtime.
  TypeScript annotations do not validate external input. Keep internal errors and
  credentials out of API responses and logs.
- Add folders and abstractions as features need them. Reuse installed libraries
  when suitable instead of introducing overlapping dependencies.

### File uploads

- `/files` provides authenticated upload/list, with download/delete by ID for the
  owner or a currently valid ADMIN. Inaccessible IDs return 404. All roles retain
  owner access even when their shared role is inactive or expired.
- Keep `FileStorage` and its filesystem implementation independent of Express and
  Prisma. Multer bridges streams to the configured provider; new providers must
  preserve `put`, `open`, and idempotent `delete` behavior and partial-write cleanup.
- Persist provider/key per file. Switching the upload provider must not reroute
  existing files. Never expose storage paths/keys or serve the root statically.
- Uploads accept one multipart `file`, no text fields, JPEG/PNG/WebP/MP4 signatures,
  and a configurable 100 MiB default limit. Preserve streaming and bounded detection.
- MP4 uploads are probed with `ffprobe` from a temporary copy, after storage and
  before metadata creation; unreadable videos return 422 and their object is deleted.
  Run FFmpeg tools only through `runMediaTool` in `src/lib/ffmpeg.ts`, with argument
  arrays (never a shell). For untrusted input keep `-protocol_whitelist file`, a
  forced input format, and the `file:` path prefix. Startup requires a working
  `ffprobe` (`FFPROBE_PATH`, default `ffprobe` on `PATH`).
- `UploadedFile.ownerId` uses SET NULL on account deletion: retain files for admins.
  Storage I/O stays outside database transactions, with compensating cleanup after
  failed metadata creation and object-first, retryable deletion.
- Document configuration and consistency limitations in README.md. Keep uploaded
  data ignored, preserve existing `.env`, and do not add tests unless requested.

### Profile pictures

- Avatar routes live in `src/routes/user.routes.ts`, behind `authenticate` and
  `requireSelfOrAdmin`, which checks access before the multipart body is read.
  HTTP handling is in `src/controllers/avatar.controller.ts` and storage plus
  Prisma work in `src/services/avatar.service.ts`, which rechecks the actor in
  each `serializable` transaction.
- Uploads reuse `createUploadMiddleware` with `imageUploadTypes` and the
  `renderAvatar` transform from `src/lib/avatar-image.ts`. Always re-encode
  through it: never store or serve the uploaded bytes, which can carry EXIF GPS data.
  It caps uploads at 10 MiB and decoding at 50 megapixels, and outputs a 512×512 WebP.
- `UserAvatar` holds one row per user (`ON DELETE CASCADE`) with its own provider
  and key. Storage I/O stays outside transactions: replaced objects and deleted
  users' objects are discarded after the commit, best effort; removal deletes
  the object first, then the row matched by key.
- `deleteUser` returns the avatar location so the controller can discard the
  object; keep that cleanup when changing account deletion.

### Credits

- `/credits` routes live in `src/routes/credit.routes.ts`, validation in
  `src/lib/credit-validation.ts`, and Prisma work in `src/services/credit.service.ts`.
  Users buy credits through `CreditPurchase` rows that an admin confirms by hand
  until a card processor is chosen; `CreditTransaction` is the append-only ledger.
- Only `applyCreditChange` may change `User.creditBalance`. It uses a guarded
  increment and writes the matching ledger row; call it inside the same
  transaction as the reason for the movement. Never edit or delete ledger rows:
  correct mistakes with new `ADJUSTMENT` rows.
- Run credit operations through `serializable` from `src/lib/transaction.ts` and
  recheck the actor inside the transaction. Confirmation must stay idempotent:
  a purchase credits its owner at most once (the unique `purchaseId` is the backstop).
- Prices come from `CREDIT_CURRENCY` and `CREDIT_UNIT_PRICE_MINOR` and are
  snapshotted on each purchase; never accept a price from the client.
- The credits migration adds CHECK constraints that Prisma doesn't track; keep
  them in future migrations. Purchases and ledger rows use SET NULL on account deletion.

### App config

- `/config` routes live in `src/routes/config.routes.ts`, behind `authenticate` and
  `requireAdmin`. Validation is in `src/lib/config-validation.ts` and Prisma work in
  `src/services/config.service.ts`, which rechecks the admin in each `serializable` transaction.
- `AppConfig` maps a text key to a `JSONB` value. Keep the key pattern in
  `config-validation.ts` aligned with the `AppConfig_key_check` constraint, and keep
  that constraint and `AppConfig_value_check` (no top-level JSON null) in future migrations.
- It holds runtime settings only. Secrets and deployment settings stay in environment
  variables, because every admin can read every entry.

## Database and configuration

- Reuse the shared client exported by `src/lib/prisma.ts`; do not create a Prisma
  client per request. It uses `@prisma/adapter-pg` and requires `DATABASE_URL`.
- Define models in `prisma/schema.prisma`. CLI configuration and the datasource
  URL live in `prisma.config.ts`, which loads `.env` with Node's environment loader.
- Role dates use `TIMESTAMPTZ(3)`; a migration-managed check constraint requires
  `endDate > startDate` when non-null. Preserve this constraint in future migrations.
  User creation defaults to USER in the API, then resolves its role ID in the
  service; direct inserts must supply a role reference. Referenced roles cannot
  be deleted. There are no role-management endpoints.
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

### Synchronizing Prisma after schema changes

Whenever `prisma/schema.prisma` changes, synchronize the schema, database, and
generated client together. Run these commands from `backend/`:

1. Confirm `DATABASE_URL` points to the intended development database and that
   PostgreSQL is running (`npm run db:check`). If needed, start the local database
   with `docker compose up --build -d --wait`.

2. Format and validate the edited schema:

   ```sh
   npx prisma format
   npm run prisma:validate
   ```

3. Create a named migration without applying it yet, then inspect its SQL under
   `prisma/migrations/` for unintended drops, data loss, and required data backfills:

   ```sh
   npm run db:migrate -- --name describe_the_change --create-only
   ```

   If existing rows need a backfill or a staged change, adjust the new, unapplied
   migration before proceeding. Never rewrite a migration already applied or
   shared with others. If Prisma reports drift or requests a reset, investigate
   and resolve it while preserving existing data; do not accept a reset as a fix.

4. Apply the reviewed migration, regenerate Prisma Client explicitly, and check
   the application; do not rely on migration commands to regenerate the client:

   ```sh
   npm run db:migrate
   npm run prisma:generate
   npm run typecheck
   npx prisma migrate status
   ```

5. Run existing tests with `npm test` when the change affects user/authentication
   behavior. Write or modify tests only if explicitly requested. Commit the schema
   and migration files (including `migration_lock.toml`) together. Generated client
   files remain ignored and must not be edited or committed.

For a schema-only change that produces no SQL migration, still validate and
regenerate the client, then type-check. When pulling existing migrations into a
development checkout, run `npm run db:migrate` and `npm run prisma:generate`.
Deployment environments apply committed migrations with `npx prisma migrate deploy`;
they must never use `migrate dev` or create migrations. Generate the
client separately during installation/build. `prisma generate` changes only the
client, not the database; do not use `prisma db push` as a substitute for tracked
migrations in this project.

## Verification

- After application code, dependency, or TypeScript configuration changes, run
  `npm run typecheck`. Development mode reports type errors but does not prevent
  the server from running, so startup alone is not a type check.
- For authentication, service, controller, middleware, or routing changes, run
  `npm test` as well. Keep fixtures isolated and never reset or truncate tables.
- For Prisma changes, run `npm run prisma:validate` and
  `npm run prisma:generate` before type checking. Use `npm run db:check` when
  database configuration or connectivity changes and a database is available.
- For API changes, exercise the affected endpoints and relevant invalid-input
  and not-found cases. For server lifecycle changes, also check startup and clean
  shutdown. Report failed checks or checks that could not run.
- Verify changes to shared role validity only in an isolated development database
  so existing accounts are not affected. Cover date boundaries, admin-only denial,
  continued login/profile access, reactivation, and bootstrap rejection.
- Integration tests cover the current authentication and user-management API.
  They require a migrated development database with the built-in roles and a
  currently active ADMIN role. Fixtures seed disposable administrators and use
  the protected API for account creation; never change shared role lifecycle
  settings or existing accounts to make tests pass. File API checks remain manual.
- For documentation-only changes, review accuracy and check whitespace;
  application startup and database changes are unnecessary.
- If test tooling changes, document its commands here. Write or modify tests only
  when explicitly requested. Keep this file aligned with the actual project setup.
