-- CreateTable
CREATE TABLE "ScreenPreset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "canvasWidth" INTEGER NOT NULL,
    "canvasHeight" INTEGER NOT NULL,
    "regions" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ScreenPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScreenPreset_createdAt_id_idx" ON "ScreenPreset"("createdAt", "id");

-- Actual, unconfirmed ViPlex photo configuration; not demonstration data.
INSERT INTO "ScreenPreset" ("name", "canvasWidth", "canvasHeight", "regions", "updatedAt") VALUES (
    'ViPlex foto – Versiunea A', 2304, 512,
    '{"left":{"x":0,"y":0,"width":1018,"height":512,"fit":"contain"},"middle":{"x":1024,"y":0,"width":512,"height":512,"fit":"contain"},"right":{"x":1585,"y":0,"width":719,"height":512,"fit":"contain"}}',
    CURRENT_TIMESTAMP
);
