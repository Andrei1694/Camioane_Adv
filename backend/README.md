# Camioane Backend

Express 5, TypeScript, Prisma 7, PostgreSQL, and Node.js 24+. Node runs TypeScript directly; there is no backend build step.

## Local setup

From `backend/`, install with `npm ci`. On a new checkout, copy `.env.example` to `.env` without overwriting existing settings. Set a random `JWT_SECRET` of at least 32 bytes:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Keep the generated secret in the local environment only.

npm installs [sharp](https://sharp.pixelplumbing.com/), which re-encodes profile pictures, with a prebuilt libvips for Linux, macOS, and Windows; it needs no other system packages.

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
| `CREDIT_CURRENCY` | Three-letter uppercase currency code for credit purchases, default `EUR` |
| `CREDIT_UNIT_PRICE_MINOR` | Price of one credit in the currency's minor unit (cents), default `100`; integer from 1 through 21474 |

Existing environment variables take precedence over `.env`. CORS allows GET, POST, PUT, PATCH, DELETE, JSON, and Authorization headers from the configured origin. Authentication uses bearer tokens, not cookies. Keep private database credentials and signing keys out of frontend `VITE_*` configuration.

Production must set its actual frontend origin, configure HTTPS, and supply the actual API URL when building the frontend. When serving the frontend separately, configure its host to serve `index.html` for application routes such as `/users`. Deploy committed migrations with `npx prisma migrate deploy` and generate Prisma Client during installation/build. Do not run `migrate dev` in production.

## API

Public users are `{ id, email, role, avatar }`, where `id` is an immutable UUID, `role` is `ADMIN`, `OPERATOR`, `DRIVER`, or `USER`, and `avatar` is `null` or `{ url, updatedAt }` (see [Profile pictures](#profile-pictures)). Roles are stored in a shared table, but API requests and responses use these enum names as strings. Only `ADMIN` grants account-management access; all roles can access their profile and manage their own uploaded files and profile picture. Responses never include password hashes, session versions, role IDs, or role validity fields. User responses have `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`. There are no role-management endpoints.

| Method and route | Access | Result |
| --- | --- | --- |
| `GET /` | Public | `{ "message": "Camioane API" }` |
| `GET /health` | Public | `{ "status": "ok" }`; does not query the database |
| `POST /users/login` | Public | Authentication response below |
| `GET /users/me` | Signed in | `{ user }` |
| `GET /users` | Admin | `{ users }`, all accounts ordered by email |
| `POST /users` | Admin | `201 { user }`; does not change the acting admin's session |
| `PATCH /users/:id` | Admin | `{ user }` |
| `DELETE /users/:id` | Admin | `204`, no response body; also deletes the user's profile picture |
| `PUT /users/:id/avatar` | Self or active admin | Multipart `file` (JPEG, PNG, or WebP); `{ user }` |
| `GET /users/:id/avatar` | Self or active admin | The picture as `image/webp`; `404` when there is none |
| `DELETE /users/:id/avatar` | Self or active admin | `204`, also when there is no picture |
| `POST /files` | Signed in | Multipart `file`; `201 { file }` |
| `GET /files` | Signed in | `{ files, total }`; own files, or all files for an active admin |
| `GET /files/:id/download` | Owner or active admin | Binary attachment with the detected MIME type |
| `DELETE /files/:id` | Owner or active admin | `204`, no response body |
| `GET /credits/balance` | Signed in | `{ balance, currency, unitPriceMinor }`; own balance, or `?userId=` for an active admin |
| `GET /credits/transactions` | Signed in | `{ transactions, total }`; own ledger, or all / `?userId=` for an active admin |
| `POST /credits/purchases` | Signed in | `{ credits }`; `201 { purchase }` with status `PENDING` |
| `GET /credits/purchases` | Signed in | `{ purchases, total }`; own, or all / `?userId=` for an active admin; optional `?status=` |
| `POST /credits/purchases/:id/cancel` | Owner or active admin | `{ purchase }`; pending → `CANCELED` |
| `POST /credits/purchases/:id/confirm` | Admin | Optional `{ reference }`; `{ purchase, transaction }`; pending → `PAID` and credits the owner |
| `POST /credits/purchases/:id/fail` | Admin | `{ purchase }`; pending → `FAILED` |
| `POST /credits/adjustments` | Admin | `{ userId, amount, note }`; `201 { transaction }` |

Public registration is removed: `POST /users/register` returns the standard JSON 404. Unknown routes also return JSON 404.

Login accepts `{ email, password }` and returns:

```json
{
  "user": { "id": "<uuid>", "email": "admin@example.com", "role": "ADMIN", "avatar": null },
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

## Profile pictures

`PUT /users/:id/avatar` sets or replaces a user's profile picture. Users can change their own, and a currently valid administrator can change anyone's. Send exactly one nonempty image in the multipart field `file`, with no other fields, as for file uploads. It must be JPEG, PNG, or WebP, detected from its content, and at most 10 MiB. The API decodes it with sharp, applies the EXIF orientation, crops it to a centered 512×512 square, and stores it as WebP. The uploaded file itself is never stored and no metadata is kept, so EXIF data such as GPS location is dropped. Images over 50 megapixels, or that can't be decoded, return `422`.

```sh
curl -X PUT -H "Authorization: Bearer <accessToken>" -F "file=@me.jpg" http://localhost:3000/users/<id>/avatar
```

The response is `{ user }` with the new `avatar`. In every public user, `avatar` is `null` or `{ url, updatedAt }`: `url` is `/users/<id>/avatar`, and `updatedAt` is the ISO time of the last upload, so it changes with each upload and works as a cache key. Like `downloadUrl` for files, `url` is relative to the API and needs the bearer token; browsers fetch it with authorization and show it through an object URL. `GET /users/:id/avatar` returns the image with `Content-Type: image/webp` and `Content-Length`, or `404` when the user has none. `DELETE /users/:id/avatar` returns `204`, also when there was no picture. Picture changes don't increment the session version, so they sign no one out.

Access is checked before the upload is read: a malformed ID returns `400`, and a non-administrator naming another user gets `403`. A missing user returns `404`. Other upload errors match file uploads: `400` for malformed multipart, `413` over 10 MiB, and `415` for unsupported request or content types.

Pictures use the provider selected for new uploads (`FILE_STORAGE_DRIVER`) under their own UUID keys, persist their provider and key, and never appear in `/files`. A replacement is saved in one serializable transaction, and the old object is deleted after it commits. Removing a picture deletes the object first, then the row, so a failed database delete can be retried. Deleting a user cascades to their picture's row, and the API deletes the object after the deletion commits. Those after-commit deletions are best effort: a failure is logged without details and leaves an orphaned object, never a broken picture. Concurrent changes to one user's picture are serialized; after three conflicting attempts the request returns `409`. Re-encoding happens in memory, so each upload in progress holds the original (up to 10 MiB) plus libvips' working memory. The image code lives in `src/lib/avatar-image.ts`.

## Credits

Clients buy prepaid credits with money and will later spend them on campaigns. Credits are whole numbers. No card processor is integrated yet, so a purchase is settled by hand:

1. A signed-in user creates a purchase with `{ credits }` (1–100000). The server sets the price from `CREDIT_UNIT_PRICE_MINOR` and `CREDIT_CURRENCY` and stores it on the purchase, so later price changes don't affect it. Request bodies can't set a price.
2. The purchase stays `PENDING` and adds nothing to the balance.
3. After checking the payment outside the app, an admin confirms it, optionally with a payment `reference` (1–128 characters, unique among manual confirmations). This marks it `PAID` and writes one `PURCHASE` ledger row in the same transaction. Alternatively the admin marks it `FAILED`, or the owner or an admin cancels it.

Confirming a `PAID` purchase again returns the original purchase and ledger row without crediting twice. Marking a `FAILED` purchase failed again, or canceling a `CANCELED` one again, returns it unchanged. A later card-payment webhook should call the same confirmation service so retried notifications stay idempotent.

Public purchases are `{ id, userId, credits, unitPriceMinor, amountMinor, currency, status, reference, createdAt, settledAt }`, where `amountMinor = credits × unitPriceMinor`. Ledger rows are `{ id, userId, amount, balanceAfter, type, purchaseId, note, createdAt }`, where `amount` is positive for credits and negative for debits, and `type` is `PURCHASE`, `ADJUSTMENT`, `CAMPAIGN_DEBIT`, or `REFUND`. Campaign debits and refunds have no endpoints yet; campaign confirmation should call `applyCreditChange` from `src/services/credit.service.ts` inside its own transaction. Admin adjustments take a non-zero `amount` (±1000000) and a required `note` (1–500 characters), and the owner can see the note.

The ledger is append-only: corrections are new `ADJUSTMENT` rows. `User.creditBalance` caches the ledger total. It only changes through a guarded increment that can't go below zero, together with the matching ledger row. Every credit operation runs in a serializable transaction that rechecks the session and administrator validity. Lists use the same `limit`/`offset` rules as files, newest first. A non-admin who passes another user's `userId` gets `403`, and another user's purchase IDs return `404`.

Errors: `400` for invalid bodies, IDs, or query parameters; `403` for admin-only actions; `404` for missing or inaccessible purchases and users; `409` for insufficient credits, a balance over the INT4 maximum, invalid status changes, a deleted purchase owner, a reused payment reference, or repeated concurrent-write conflicts. Deleting a user sets `userId` to `null` on their purchases and ledger rows, so the financial history is kept. Their remaining balance is lost with the account.

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

`UserAvatar` stores at most one profile picture per user: the user ID as primary key and foreign key (`ON DELETE CASCADE`), a unique provider/key pair, the MIME type, the byte count, and the time of the last upload. The user-avatars migration adds this table without changing existing data.

`CreditPurchase` stores the owner (`ON DELETE SET NULL`), credits, unit price and total in minor units, currency, status (`PENDING`, `PAID`, `FAILED`, `CANCELED`), provider and provider payment ID (unique together), the settling admin, and timestamps. `CreditTransaction` is the append-only ledger: owner (`ON DELETE SET NULL`), signed amount, balance after the movement, type, an optional unique purchase link (one ledger row per purchase), the creating admin, a note, and a timestamp. `User.creditBalance` defaults to zero. The credits migration adds database CHECK constraints that Prisma schema syntax can't express: non-negative balances, positive purchase credits and prices, `amountMinor = credits × unitPriceMinor`, uppercase three-letter currencies, non-zero ledger amounts, and a purchase link on exactly the `PURCHASE` rows. Keep them in future migrations.

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
npm run test:coverage
```

Tests use Node's runner and the migrated development PostgreSQL database, with the built-in roles present and the shared ADMIN role currently active. FFmpeg must be installed: the media and upload tests run the real `ffprobe` (and `ffmpeg -version`). Test files run one at a time. Each one seeds uniquely named accounts and removes only the accounts and rows it created; uploads go to temporary directories. Tests do not modify shared roles or existing accounts. Run only against a development database.

`npm run test:coverage` reports coverage of `src/` (the generated Prisma client excluded) and fails below 100% line coverage. Branch and function coverage are reported but not enforced. One test needs POSIX signals and is skipped on Windows, so the gate passes on Linux and macOS.

The suite covers:

- configuration, input validation, role validity, filesystem storage and the provider registry
- ffprobe runs and probe output, profile picture re-encoding (EXIF removal included), and upload type detection
- accounts: administrator-created users, password hashing and validation, UUID/session-version JWTs, login-only rate limiting, permissions for all four roles, listing and updates, duplicate emails, session revocation, delete/recreate isolation, administrator self-protection and last-administrator protection, removed public registration, and the bootstrap service
- profile pictures and files: uploads of every accepted type, rejected and malformed uploads, size limits, unreadable videos, storage failures, client disconnects at each stage (with no orphaned objects), downloads, deletion and access scoping
- credits: balances, purchases and their state rules, idempotent confirmation, payment references, adjustments within the balance limits, and the ledger
- serialization-conflict retries, CORS, JSON errors, server startup and shutdown, `db:check`, and the interactive `admin:bootstrap`

Concurrent administrator changes are still verified manually, with disposable development accounts. Clean up only the accounts created for verification. Never inspect logs unless explicitly requested.

Verify role lifecycle changes in an isolated development database because modifying a shared role affects all its accounts. Check inactive, future, expired, bounded, and open-ended roles; exact start/end boundaries; login and profile availability; `403` responses for administrator operations; reactivation with an existing token; service-level enforcement; and bootstrap rejection without silently activating a role. Check migration preservation and the date-range and referenced-role deletion constraints as well.

Other commands: `npm run dev:server`, `npm run typecheck:watch`, `npm run db:studio`, and `npm run prisma:generate`.
