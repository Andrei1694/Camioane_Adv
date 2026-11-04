-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- Integrity checks (not expressible in the Prisma schema; keep them in future migrations)
ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_.-]{0,99}$');
-- Clearing a setting deletes its row; a stored JSON null would be ambiguous.
ALTER TABLE "AppConfig" ADD CONSTRAINT "AppConfig_value_check" CHECK (jsonb_typeof("value") <> 'null');
