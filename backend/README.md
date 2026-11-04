# Camioane Backend

Express 5, TypeScript, Prisma 7, PostgreSQL, and Node.js 24+. Node runs TypeScript directly; there is no backend build step.

## Local setup

From `backend/`, install with `npm ci`. On a new checkout, copy `.env.example` to `.env` without overwriting existing settings. Set a random `JWT_SECRET` of at least 32 bytes:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the generated secret in the local environment only.

Install FFmpeg so that `ffprobe` is available. The API checks MP4 uploads with it and refuses to start without it. On Windows, run `winget install Gyan.FFmpeg` and open a new terminal so `PATH` updates; on macOS, `brew install ffmpeg`; on Debian or Ubuntu, `sudo apt-get install ffmpeg`. If `ffprobe` isn't on `PATH`, set `FFPROBE_PATH` to the binary.

Start Docker Desktop with Linux containers, then:

```sh
docker compose up --build -d --wait
npx prisma migrate deploy
npm run prisma:generate
npm run db:check
npm run admin:bootstrap
npm run dev
```

The bootstrap command requires an interactive terminal. It asks for an email and, for a new account, a hidden password and confirmation. For an existing ordinary account, it explicitly asks before granting administrator access and preserves the password. An existing administrator is left unchanged. Promotion invalidates existing sessions. The shared `ADMIN` role must exist and be currently valid, including for an existing administrator; bootstrap reports an unavailable role without creating or reactivating it. There are no default accounts or passwords.

The API listens on port 3000 by default. Compose runs PostgreSQL only. `npm run dev` runs the API watcher and type checker together; type errors do not prevent the server from starting. `npm start` runs without watchers.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | API port, default `3000` |
| `DATABASE_URL` | Required PostgreSQL connection URL |
| `JWT_SECRET` | Required random signing secret, at least 32 bytes |
| `FRONTEND_ORIGIN` | Allowed HTTP(S) origin, default `http://localhost:5173`; no path or trailing slash |
| `FILE_STORAGE_DRIVER` | Provider for new uploads, default `filesystem`; unknown providers fail startup |
| `FILE_STORAGE_ROOT` | Private filesystem directory, default `./uploads`; relative to `backend/`, independent of the working directory |
| `UPLOAD_MAX_FILE_SIZE_BYTES` | Maximum file bytes, default `104857600` (100 MiB); integer from 1 through 2147483647 |
| `FFPROBE_PATH` | `ffprobe` command name or path, default `ffprobe` from `PATH`; startup fails if it can't run or isn't ffprobe |

Existing environment variables take precedence over `.env`. CORS allows GET, POST, PATCH, DELETE, JSON, and Authorization headers from the configured origin. Authentication uses bearer tokens, not cookies. Keep private database credentials and signing keys out of frontend `VITE_*` configuration.

Production must set its actual frontend origin, configure HTTPS, and supply the actual API URL when building the frontend. When serving the frontend separately, configure its host to serve `index.html` for application routes such as `/users`. Deploy committed migrations with `npx prisma migrate deploy` and generate Prisma Client during installation/build. Do not run `migrate dev` in production.

## API

Public users are `{ id, email, role }`, where `id` is an immutable UUID and `role` is `ADMIN`, `OPERATOR`, `DRIVER`, or `USER`. Roles are stored in a shared table, but API requests and responses use these enum names as strings. Only `ADMIN` grants account-management access; all roles can access their profile and manage their own uploaded files. Responses never include password hashes, session versions, role IDs, or role validity fields. User responses have `Cache-Control: no-store`. There are no role-management endpoints.

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
| `POST /files` | Signed in | Multipart `file`; `201 { file }` |
| `GET /files` | Signed in | `{ files, total }`; own files, or all files for an active admin |
| `GET /files/:id/download` | Owner or active admin | Binary attachment with the detected MIME type |
| `DELETE /files/:id` | Owner or active admin | `204`, no response body |

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
- `403`: administrator access required, including when the shared `ADMIN` role is inactive, not yet started, or expired.
- `404`: missing account or route.
- `409`: duplicate email, self-deletion/demotion, last-administrator protection, missing role configuration, or repeated concurrent-write conflicts.
- `413`: body over 16 KiB; `415`: unsupported encoding.
- `429`: login rate limit; `500`: generic unexpected failure.

Login is limited to 20 requests per IP per 15 minutes, including successful and invalid attempts. The limit is in memory and returns `Retry-After`. Multi-instance hosting requires a shared limiter store; configure proxy trust to match the actual trusted proxy topology before deployment.

## Uploaded files

Send exactly one nonempty file in the multipart field `file`, with no additional fields. The API accepts JPEG, PNG, WebP, and MP4, identified from a bounded 4100-byte content sample using `file-type`. The client-declared MIME type and filename extension do not determine acceptance. This detects format signatures only; MP4 uploads are then checked with `ffprobe` (see [Video probing](#video-probing)). Neither check enforces limits on codecs, dimensions, duration, or suitability for a controller, because those constraints aren't decided yet. There is no transcoding or campaign approval workflow in this API.

```sh
curl -H "Authorization: Bearer <accessToken>" -F "file=@advertisement.mp4" http://localhost:3000/files
```

Browser clients should send a `FormData` body and let the browser set the multipart `Content-Type` and boundary. Do not use the JSON request helper for file bodies. `downloadUrl` is relative to the API and also requires the bearer token; fetch it with authorization before creating a browser download.

Public file metadata is `{ id, ownerId, originalName, mimeType, size, createdAt, downloadUrl }`. `size` is the actual byte count; `createdAt` is an ISO timestamp; `originalName` is a sanitized display/attachment filename. Storage paths, keys, and provider names are private. Deleting a user sets `ownerId` to `null` and retains their files for active administrators.

`GET /files?limit=50&offset=0` paginates newest first, with descending IDs breaking timestamp ties. `limit` is 1–100 and `offset` is 0–2147483647; defaults are 50 and 0. Invalid, repeated, or unsupported query parameters return `400`. `total` counts only files visible to the current user. An inactive, future, or expired administrator retains ordinary owner access but cannot access other users' files. Missing and inaccessible file IDs both return `404`; malformed IDs return `400`.

All file routes require a current session and return `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. Downloads are streamed as attachments with `Content-Length`; range playback is not implemented. Upload errors use the existing `{ error: message }` format: `400` for malformed multipart, missing/empty files, wrong fields, or additional parts; `413` for files over the configured limit; `415` for unsupported request/content types; `422` for MP4 files that ffprobe can't read or that lack a usable video stream; and generic `500` for storage or database failures, or when ffprobe can't run. Authentication runs before multipart parsing.

### Video probing

After an MP4 is stored, and before its metadata is saved, the API copies it from the storage provider into a new private directory under the OS temporary directory (`os.tmpdir()`, which follows `TMPDIR` on Unix and `TEMP` on Windows) and runs `ffprobe` on the copy. The copy is needed because many MP4 files keep their index at the end, which ffprobe can't reach through a pipe, and it keeps probing independent of the storage provider. The temporary directory is removed afterward.

The upload is rejected with `422`, and its stored object deleted, when ffprobe can't read the file as MP4, or when the first video stream lacks a codec, positive dimensions, or a positive duration. ffprobe runs without a shell, may read only local files (`-protocol_whitelist file`), uses only the MP4 demuxer, and is killed after 30 seconds. A missing binary or a timeout returns the generic `500`.

Probing reads container metadata only. It doesn't decode frames, enforce limits, store the metadata, or transcode. Each MP4 upload in progress needs temporary disk space equal to its size. The helpers live in `src/lib/ffmpeg.ts`; run any future FFmpeg work through `runMediaTool` there, with argument arrays and the same input restrictions.

### Storage providers

`src/storage/file-storage.ts` defines the Express-independent `FileStorage` contract (`name`, `put`, `open`, `delete`) and `FileStorageRegistry`. `put` consumes a Node readable stream, honors cancellation, reports the actual byte count, and removes partial writes on failure. `open` opens a stream or throws `StorageNotFoundError`; `delete` succeeds when the object is already absent. The Multer adapter in `src/middleware/upload.ts` implements both storage-engine hooks and handles multipart cleanup. Files stream through bounded buffers rather than loading entire videos into memory.

The filesystem provider writes exclusively to generated UUID keys beneath `FILE_STORAGE_ROOT`, creating the directory on first use. Client filenames cannot supply paths or overwrite objects. Keep the root private and writable by the API account; do not mount it with `express.static`. The default `uploads/` directory is ignored by Git. If a custom directory is inside a checkout, ignore it too. Use a persistent volume for deployment and back it up alongside file metadata; multiple API instances require a shared volume or a shared provider.

To add S3, implement the same contract and register it in `createFileStorage` in `src/config/files.ts`, then select its name with `FILE_STORAGE_DRIVER`. Each metadata row retains its provider and key, so keep the filesystem provider registered and its root available while existing files remain there. Changing the selected provider affects new uploads only; it does not migrate old files. Controllers and HTTP response shapes stay unchanged. Factories accept injected storage, including `createApp({ fileStorage, uploadMaxFileSizeBytes })`, for isolated verification.

Metadata is inserted only after successful storage and, for MP4 files, a successful probe. A failed probe or failed metadata creation triggers object cleanup; malformed/interrupted uploads and storage failures clean up partial files. Deletion removes the object first, then metadata, so a database failure can be retried safely. Storage and PostgreSQL do not share a transaction: a process crash or failed compensating cleanup can leave orphaned objects, and a failed metadata deletion can leave a record whose content is missing. Automatic reconciliation and storage migration are not implemented. Retrying an upload after a lost success response may create another file.

## Sessions and administrator safety

JWTs use HS256, immutable user ID as `sub`, a private session-version claim, issuer `camioane-api`, audience `camioane-frontend`, and a one-hour lifetime. Middleware checks the account and session version against PostgreSQL on every request.

Email, password, and role changes increment the session version, invalidating every existing token for that account. A no-op update does not. Deletion immediately invalidates access; recreating the same email receives a different ID. The user-management migration invalidates old email-based tokens, so existing clients must sign in again.

Authorization is enforced server-side and rechecked within serializable CRUD transactions. An administrator cannot delete or demote their own account. Any change from `ADMIN` to another role is a demotion. Removing or demoting the last administrator is forbidden; serialization conflicts are retried up to three attempts. Password hashing occurs before the transaction.

Administrator operations require a shared `ADMIN` role with `activ = true`, `startDate <= now`, and either no `endDate` or `now < endDate`. The start boundary is inclusive and the end boundary exclusive. Changing this shared role affects every administrator. Middleware reads the current role on each request, and services recheck validity inside their transactions; no scheduler or role claims in JWTs are involved.

Role validity does not block login or `GET /users/me`, change the role name returned by the API, or prevent assignment of an existing role. For example, an expired administrator still receives `role: "ADMIN"` on login and profile responses, but administrator routes return `403`. Restoring role validity restores administrator access for otherwise valid sessions without signing in again. Role validity changes do not increment account session versions; changing a user's role assignment still does.

Logout discards the browser's token; a copied token remains valid until expiry or an account change. There are no refresh tokens, server-side logout, email verification, or password-recovery flows.

## Database and migrations

The local Compose defaults are database/user `camioane`, password `camioane_dev_password`, and port `5432` bound to localhost. The image extends PostgreSQL 18 Alpine with a readiness check. Keep `DATABASE_URL` aligned with `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_PORT`. Credentials apply only when initializing a new volume.

`docker compose down` stops the database while preserving its named data volume. Do not use `down -v`, Prisma resets, or truncation for routine setup.

`User` has a UUID primary key, unique email, password hash, required indexed `roleId` foreign key, and session version defaulting to zero. User creation resolves the role name in the service and defaults to `USER` at the API boundary; direct database inserts must supply a role reference. Referenced roles cannot be deleted. Reuse the client in `src/lib/prisma.ts`.

`UploadedFile` stores a UUID ID, optional owner relation (`ON DELETE SET NULL`), provider/key pair, sanitized original name, detected MIME type, integer byte count, and creation timestamp. Provider/key pairs are unique. Owner/time/ID and time/ID indexes support filtered and administrator listings. The uploaded-files migration adds this table and its indexes without changing existing user or role data.

`Role` has a UUID primary key, unique `name` constrained by the Prisma/PostgreSQL `RoleName` enum (`ADMIN`, `OPERATOR`, `DRIVER`, `USER`), `startDate` defaulting to creation time, nullable `endDate` for no expiry, and `activ` defaulting to `true`. Dates use PostgreSQL `TIMESTAMPTZ(3)` to represent instants with millisecond precision. The migration enforces `endDate > startDate` when an end date exists through the `Role_date_range_check` database constraint, which is not represented by Prisma schema syntax. Adding another role name requires a schema migration and corresponding API/frontend support.

The standalone-role migration seeds both built-in roles as active and open-ended, then maps existing enum assignments to their IDs before removing the old enum column and type. It preserves all account IDs, emails, password hashes, session versions, and assignments, so existing sessions remain valid. Lifecycle fields are shared role configuration rather than per-user assignment dates.

The subsequent role-name migration converts existing names in place and adds active, open-ended `OPERATOR` and `DRIVER` records. It preserves existing role IDs, dates, active flags, and user assignments. Unsupported pre-existing names cause the transactional conversion to fail rather than discard data.

For schema changes: check the intended development database, format/validate the schema, create a named migration with `npm run db:migrate -- --name <name> --create-only`, inspect its SQL, apply it, explicitly regenerate the client, and type-check. If the environment is non-interactive, generate SQL with `prisma migrate diff`, review and save it as a tracked migration, then apply with `prisma migrate deploy`. Never reset a database to resolve drift.

## Checks

```sh
npm run typecheck
npm run prisma:validate
npm run db:check
npx prisma migrate status
npm test
```

Tests use Node's runner and the migrated development PostgreSQL database, with the built-in roles present and the shared ADMIN role currently active. Each integration test seeds a uniquely named administrator and creates disposable accounts through the protected API. Cleanup removes only fixture accounts; tests do not modify shared roles or existing accounts. Run only against a development database.

The suite covers administrator-created accounts, password hashing and validation, UUID/session-version JWTs, login-only rate limiting, profile and management permissions for all four roles, user listing and updates, duplicate emails, session revocation, delete/recreate identity isolation, administrator self-protection, removed public registration, CORS, and JSON errors. File upload/deletion checks remain manual; no automated file API suite is included.

Verify the new API manually with disposable development accounts: bootstrap and idempotency, admin/non-admin access, CRUD and duplicate emails, validation and missing IDs, password/email/role session revocation, self-protection, concurrent administrator changes, and delete/recreate identity isolation. Clean up only the accounts created for verification. Never inspect logs unless explicitly requested.

Verify role lifecycle changes in an isolated development database because modifying a shared role affects all its accounts. Check inactive, future, expired, bounded, and open-ended roles; exact start/end boundaries; login and profile availability; `403` responses for administrator operations; reactivation with an existing token; service-level enforcement; and bootstrap rejection without silently activating a role. Check migration preservation and the date-range and referenced-role deletion constraints as well.

Other commands: `npm run dev:server`, `npm run typecheck:watch`, `npm run db:studio`, and `npm run prisma:generate`.
