BEGIN;

-- Fail before any changes instead of truncating emails or changing identities.
-- Lock out writes between validation and the column/constraint changes.
LOCK TABLE "User" IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE length("email") > 254 OR "email" <> lower("email")) THEN
    RAISE EXCEPTION 'User emails must be lowercase and at most 254 characters. Resolve existing values before migrating.';
  END IF;
  IF EXISTS (SELECT 1 FROM "User" WHERE "sessionVersion" < 0) THEN
    RAISE EXCEPTION 'User sessionVersion must be nonnegative. Resolve existing values before migrating.';
  END IF;
END $$;
-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'DISABLED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdById" UUID,
ADD COLUMN     "disabledAt" TIMESTAMPTZ(3),
ADD COLUMN     "displayName" VARCHAR(200) NOT NULL DEFAULT '',
ADD COLUMN     "lastLoginAt" TIMESTAMPTZ(3),
ADD COLUMN     "passwordChangedAt" TIMESTAMPTZ(3),
ADD COLUMN     "phone" VARCHAR(32),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "email" SET DATA TYPE VARCHAR(254);

-- Backfill both timestamps at migration time; Prisma owns updatedAt thereafter.
-- Historical creator, login and password-change times remain unknown (NULL).
ALTER TABLE "User" ALTER COLUMN "updatedAt" DROP DEFAULT,
ADD CONSTRAINT "User_email_lowercase_check" CHECK ("email" = lower("email")),
ADD CONSTRAINT "User_sessionVersion_nonnegative_check" CHECK ("sessionVersion" >= 0);

-- CreateIndex
CREATE INDEX "User_createdById_idx" ON "User"("createdById");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
