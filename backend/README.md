# Camioane Backend

Express 5, TypeScript, Prisma 7, PostgreSQL, and Node.js 24+. Node runs TypeScript directly; there is no backend build step.

## Local setup

From `backend/`, install with `npm ci`. On a new checkout, copy `.env.example` to `.env` without overwriting existing settings. Set a random `JWT_SECRET` of at least 32 bytes:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the generated secret in the local environment only. Start Docker Desktop with Linux containers, then:

```sh
docker compose up --build -d --wait
npx prisma migrate deploy
npm run prisma:generate
npm run db:check
npm run admin:bootstrap
npm run dev
```

The bootstrap command requires an interactive terminal. It asks for an email and, for a new account, a hidden password and confirmation. For an existing ordinary account, it explicitly asks before granting administrator access and preserves the password. An existing administrator is left unchanged. Promotion invalidates existing sessions. There are no default accounts or passwords.

The API listens on port 3000 by default. Compose runs PostgreSQL only. `npm run dev` runs the API watcher and type checker together; type errors do not prevent the server from starting. `npm start` runs without watchers.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, default `3000` |
| `DATABASE_URL` | Required PostgreSQL connection URL |
| `JWT_SECRET` | Required random signing secret, at least 32 bytes |
| `FRONTEND_ORIGIN` | Allowed HTTP(S) origin, default `http://localhost:5173`; no path or trailing slash |

Existing environment variables take precedence over `.env`. CORS allows GET, POST, PATCH, DELETE, JSON, and Authorization headers from the configured origin. Authentication uses bearer tokens, not cookies. Keep private database credentials and signing keys out of frontend `VITE_*` configuration.

Production must set its actual frontend origin, configure HTTPS, and supply the actual API URL when building the frontend. When serving the frontend separately, configure its host to serve `index.html` for application routes such as `/users`. Deploy committed migrations with `npx prisma migrate deploy` and generate Prisma Client during installation/build. Do not run `migrate dev` in production.

## API

Public users are `{ id, email, role }`, where `id` is an immutable UUID and `role` is `USER` or `ADMIN`. Responses never include password hashes or session versions. User responses have `Cache-Control: no-store`.

| Method and route | Access | Result |
| --- | --- | --- |
| `GET /` | Public | `{ "message": "Camioane API" }` |
| `GET /health` | Public | `{ "status": "ok" }`; does not query the database |
| `POST /users/login` | Public | Authentication response below |
| `GET /users/me` | Signed in | `{ user }` |
| `GET /users` | Admin | `{ users }`, all accounts ordered by email |
| `POST /users` | Admin | `201 { user }`; does not change the acting admin's session |
| `PATCH /users/:id` | Admin | `{ user }` |
| `DELETE /users/:id` | Admin | `204`, no response body |

Public registration is removed: `POST /users/register` returns the standard JSON 404. Unknown routes also return JSON 404.

Login accepts `{ email, password }` and returns:

```json
{
  "user": { "id": "<uuid>", "email": "admin@example.com", "role": "ADMIN" },
  "accessToken": "<signed JWT>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

Send `Authorization: Bearer <accessToken>` for protected requests. Account creation accepts `{ email, password, role? }`, defaulting to `USER`. Updates accept one or more of `email`, `password`, and `role`; omit an unchanged password. An explicitly empty password is invalid. Unsupported fields are rejected.

Emails are trimmed, lowercased, unique, and at most 254 characters. Passwords contain 12–128 Unicode characters; spaces are preserved. Hashes use salted Argon2id with 19 MiB memory, two iterations, and parallelism one.

Errors are `{ "error": "message" }`:

- `400`: invalid bodies, IDs, roles, credentials, or malformed JSON.
- `401`: missing, invalid, expired, or revoked authentication; incorrect login credentials.
- `403`: administrator access required.
- `404`: missing account or route.
- `409`: duplicate email, self-deletion/demotion, last-administrator protection, or repeated concurrent-write conflicts.
- `413`: body over 16 KiB; `415`: unsupported encoding.
- `429`: login rate limit; `500`: generic unexpected failure.

Login is limited to 20 requests per IP per 15 minutes, including successful and invalid attempts. The limit is in memory and returns `Retry-After`. Multi-instance hosting requires a shared limiter store; configure proxy trust to match the actual trusted proxy topology before deployment.

## Sessions and administrator safety

JWTs use HS256, immutable user ID as `sub`, a private session-version claim, issuer `camioane-api`, audience `camioane-frontend`, and a one-hour lifetime. Middleware checks the account and session version against PostgreSQL on every request.

Email, password, and role changes increment the session version, invalidating every existing token for that account. A no-op update does not. Deletion immediately invalidates access; recreating the same email receives a different ID. The user-management migration invalidates old email-based tokens, so existing clients must sign in again.

Authorization is enforced server-side and rechecked within serializable CRUD transactions. An administrator cannot delete or demote their own account. Removing or demoting the last administrator is forbidden; serialization conflicts are retried up to three attempts. Password hashing occurs before the transaction.

Logout discards the browser's token; a copied token remains valid until expiry or an account change. There are no refresh tokens, server-side logout, email verification, or password-recovery flows.

## Database and migrations

The local Compose defaults are database/user `camioane`, password `camioane_dev_password`, and port `5432` bound to localhost. The image extends PostgreSQL 18 Alpine with a readiness check. Keep `DATABASE_URL` aligned with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_PORT`. Credentials apply only when initializing a new volume.

`docker compose down` stops the database while preserving its named data volume. Do not use `down -v`, Prisma resets, or truncation for routine setup.

`User` has UUID primary key, unique email, password hash, role defaulting to `USER`, and session version defaulting to zero. The management migration backfills IDs and defaults without replacing accounts or hashes. Reuse the client in `src/lib/prisma.ts`.

For schema changes: check the intended development database, format/validate the schema, create a named migration with `npm run db:migrate -- --name <name> --create-only`, inspect its SQL, apply it, explicitly regenerate the client, and type-check. If the environment is non-interactive, generate SQL with `prisma migrate diff`, review and save it as a tracked migration, then apply with `prisma migrate deploy`. Never reset a database to resolve drift.

## Checks

```sh
npm run typecheck
npm run prisma:validate
npm run db:check
npx prisma migrate status
npm test
```

Existing tests use Node's runner and the development PostgreSQL database, creating uniquely named fixtures with targeted cleanup. Run only against a development database. Test files were intentionally left unchanged for this integration: the legacy suite still expects open registration, email-only users, email-based JWTs, and a missing users-list route. Those expectations are obsolete; the suite is not a passing validation of the new management API. No new automated coverage was added.

Verify the new API manually with disposable development accounts: bootstrap and idempotency, admin/non-admin access, CRUD and duplicate emails, validation and missing IDs, password/email/role session revocation, self-protection, concurrent administrator changes, and delete/recreate identity isolation. Clean up only the accounts created for verification. Never inspect logs unless explicitly requested.

Other commands: `npm run dev:server`, `npm run typecheck:watch`, `npm run db:studio`, and `npm run prisma:generate`.
