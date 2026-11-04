BEGIN;

CREATE TYPE "RoleName" AS ENUM ('ADMIN', 'OPERATOR', 'DRIVER', 'USER');

-- Convert names in place to preserve role IDs, lifecycle fields, and assignments.
ALTER TABLE "Role" ALTER COLUMN "name" TYPE "RoleName" USING "name"::"RoleName";

INSERT INTO "Role" ("name") VALUES ('OPERATOR'), ('DRIVER')
ON CONFLICT ("name") DO NOTHING;

COMMIT;
