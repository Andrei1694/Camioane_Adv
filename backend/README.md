# Camioane Backend

Node.js 24+ and Express API using TypeScript ES modules.

For a new checkout, copy `.env.example` to `.env`, configure `JWT_SECRET` as described below, and start Docker Desktop. Run these commands from `backend`:

```sh
npm install
docker compose up --build -d --wait
npm run db:migrate
npm run db:check
npm run dev
```

`npm run dev` runs the server and TypeScript checker together. The server restarts when source files change, and type errors appear in the same terminal. Press Ctrl+C to stop both processes. Type errors are reported without blocking the server.

Available scripts (run from `backend`):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Server restart and continuous type checking |
| `npm run dev:server` | Server restart only |
| `npm run typecheck:watch` | Continuous type checking only |
| `npm run typecheck` | Check types once |
| `npm test` | Run authentication integration tests against the development database |
| `npm start` | Run the server without watching |
| `npm run prisma:generate` | Regenerate Prisma Client after schema changes |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run db:check` | Verify the database connection with a read-only query |
| `npm run db:migrate -- --name <name>` | Create and apply a development migration |
| `npm run db:studio` | Open Prisma Studio |

`.env` configures `PORT` (defaults to `3000`), the required `DATABASE_URL`, the required `JWT_SECRET`, and `FRONTEND_ORIGIN` (defaults to `http://localhost:5173`). Existing environment variables take precedence over `.env`. Local `.env` files are excluded from Git.

Generate a random signing secret and put its output in `JWT_SECRET` in your local `.env`; never commit it:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Startup rejects missing, blank, or shorter-than-32-byte secrets. `FRONTEND_ORIGIN` must be an HTTP(S) origin without a trailing slash or path. CORS allows that origin to send JSON and Authorization headers; authentication does not use cookies.

Endpoints:

- `GET /` returns the API name.
- `GET /health` returns `{ "status": "ok" }`.
- `POST /users/register` creates an account and signs the user in.
- `POST /users/login` verifies credentials and signs the user in.
- `GET /users/me` returns the signed-in user and requires a bearer token.
- Unknown routes return a JSON `404` response.

The Express application is defined in `src/app.ts`; `src/server.ts` verifies the PostgreSQL connection before starting the HTTP server. If the database is unavailable, startup exits with an error. On SIGINT or SIGTERM, it stops accepting requests and disconnects Prisma.

## User authentication

Both registration and login accept JSON `{ "email": "driver@example.com", "password": "a long passphrase" }`. Email addresses are trimmed and lowercased. Passwords must contain 12–128 Unicode characters; spaces are preserved. The service stores salted Argon2id hashes with 19 MiB memory, two iterations, and parallelism of one. Passwords and hashes are never returned.

Registration returns `201` and login returns `200`, both with this shape:

```json
{
  "user": { "email": "driver@example.com" },
  "accessToken": "<signed JWT>",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

Send `Authorization: Bearer <accessToken>` to `GET /users/me`; it returns `{ "user": { "email": "driver@example.com" } }`. Tokens use HS256, email as `sub`, issuer `camioane-api`, and audience `camioane-frontend`. Authentication checks the signature, required claims, one-hour lifetime, and that the user still exists. User responses have `Cache-Control: no-store`.

Errors are JSON `{ "error": "message" }`: `400` for invalid input or malformed JSON, `409` for an already registered email, `401` for incorrect credentials or invalid authentication, `413` for a body over 16 KiB, `415` for unsupported encodings, and a generic `500` for unexpected failures. Unknown emails and incorrect passwords return the same login error.

Registration and login share a limit of 20 requests per IP per 15 minutes, including successful and invalid requests; exceeding it returns JSON `429` and a `Retry-After` header. The limiter uses an in-memory store for the current single-process server. A multi-instance deployment needs a shared store; configure proxy trust for the actual trusted proxy topology before deploying behind one.

Routes delegate to the user controller for validation and responses, and to the user service for database/password operations. Authentication middleware attaches only the public user email to response locals. The shared Prisma client handles all database access.

Registration is open. This version has no email verification, roles, password reset, refresh tokens, or server-side logout. Clients sign out by discarding their token and sign in again after expiry. Other issued tokens remain usable until expiry while the user exists; changing the signing secret invalidates all existing tokens.

## Tests

Start the development database and apply migrations before running:

```sh
npm test
npm run typecheck
```

Tests use Node's built-in test runner, native `fetch`, and real PostgreSQL via the configured `DATABASE_URL`. They start servers on ephemeral loopback ports, generate an ephemeral signing secret, create uniquely named fixture users, and delete only those fixtures afterward. Run against a development database, not production. Tests do not modify `.env`, reset the database, or truncate tables. `npm run typecheck` also checks test code.

## PostgreSQL with Docker

Install and start Docker Desktop with Linux containers enabled. From `backend`, build and start the database, waiting until it is healthy:

```sh
docker compose up --build -d --wait
```

`Dockerfile` extends the [official PostgreSQL 18 Alpine image](https://hub.docker.com/_/postgres) and adds a readiness check. Compose publishes it at `127.0.0.1:5432` and keeps its data in a named volume mounted at `/var/lib/postgresql`.

The local defaults are database `camioane`, user `camioane`, and password `camioane_dev_password`. To customize them, update `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, or `POSTGRES_PORT` in `.env`. The example credentials are for local development. Keep `DATABASE_URL` in sync with those settings; URL-encode any special characters in its username or password.

Inspect the container and logs:

```sh
docker compose ps
docker compose logs -f postgres
```

Stop and remove the container while retaining database data:

```sh
docker compose down
```

Database credentials and the initial database name are applied only when the volume is first initialized. Changing `.env` afterward does not change existing database users or databases. `docker compose down -v` deletes the database volume and all its data; use it only when deliberately resetting the local database.

## Prisma

`prisma/schema.prisma` defines the PostgreSQL datasource and the `User` model. A user has two required fields: `email` (the primary key, so each address is unique) and `password` (for a password hash, never plaintext). Code that creates or updates users must hash passwords before saving them; Prisma does not hash them automatically. The initial migration creates the `User` table.

`prisma.config.ts` loads `.env` with Node's built-in environment loader and supplies `DATABASE_URL` to the Prisma CLI. The shared client in `src/lib/prisma.ts` uses the [Prisma 7 PostgreSQL driver adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers). Import that client in backend modules:

```ts
import { prisma } from './lib/prisma.ts';
```

`npm install` generates Prisma Client automatically in `src/generated/prisma`, which is excluded from Git. Generated imports use `.ts` extensions so Node.js can run them directly. After adding or changing models, run:

```sh
npm run db:migrate -- --name describe_your_change
npm run prisma:generate
```

Commit the schema and generated migration files. Use `npm run db:check` to verify connectivity without modifying database data.

## TypeScript

Node.js runs the `.ts` source directly, with no build step. Run the type checker from `backend`:

```sh
npm run typecheck
```

Keep annotations minimal: type function inputs and data objects when needed, and let TypeScript infer local variables and return types.

```ts
function canCarry(weightKg: number) {
  return weightKg <= 20000;
}

canCarry(15000); // OK
// canCarry('15000'); // Type error if uncommented
```

Use `.ts` extensions in relative imports, such as `import app from './app.ts'`, and `import type` for type-only imports.

The configuration enables strict checking and limits TypeScript syntax to what Node.js can strip, such as annotations, type aliases, and interfaces. `npm run dev` checks types continuously; `npm start` only runs the app. Types do not validate incoming API data at runtime.
