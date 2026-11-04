BEGIN;

-- PostgreSQL tables also create a type, so free the Role name first.
ALTER TYPE "Role" RENAME TO "Role_legacy";

CREATE TABLE "Role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMPTZ(3),
    "activ" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Role_date_range_check" CHECK ("endDate" IS NULL OR "endDate" > "startDate")
);

CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

INSERT INTO "Role" ("name") VALUES ('USER'), ('ADMIN');

-- Backfill while the original enum assignments are still available.
ALTER TABLE "User" ADD COLUMN "roleId" UUID;

UPDATE "User" AS account
SET "roleId" = role."id"
FROM "Role" AS role
WHERE role."name" = account."role"::text;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;
CREATE INDEX "User_roleId_idx" ON "User"("roleId");
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey"
FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User" DROP COLUMN "role";
DROP TYPE "Role_legacy";

COMMIT;
