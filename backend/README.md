# Camioane Backend

Node.js 24+ and Express API using TypeScript ES modules.

For a new checkout, copy `.env.example` to `.env` and start Docker Desktop. Run these commands from `backend`:

```sh
npm install
docker compose up --build -d --wait
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
| `npm start` | Run the server without watching |
| `npm run prisma:generate` | Regenerate Prisma Client after schema changes |
| `npm run prisma:validate` | Validate the Prisma schema |
| `npm run db:check` | Verify the database connection with a read-only query |
| `npm run db:migrate -- --name <name>` | Create and apply a development migration |
| `npm run db:studio` | Open Prisma Studio |

`.env` configures `PORT` (defaults to `3000`) and the required `DATABASE_URL`. Existing environment variables take precedence over `.env`. Local `.env` files are excluded from Git.

Endpoints:

- `GET /` returns the API name.
- `GET /health` returns `{ "status": "ok" }`.
- Unknown routes return a JSON `404` response.

The Express application is defined in `src/app.ts`; `src/server.ts` verifies the PostgreSQL connection before starting the HTTP server. If the database is unavailable, startup exits with an error. On SIGINT or SIGTERM, it stops accepting requests and disconnects Prisma.

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

`prisma/schema.prisma` defines the PostgreSQL datasource. Add application models there when their fields are known; no application tables or migrations are created by this initial connection setup.

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
