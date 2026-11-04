BEGIN;

CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- Backfill a distinct immutable ID per account without changing email/password.
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
ADD COLUMN "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN "role" "Role" NOT NULL DEFAULT 'USER',
ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

COMMIT;
