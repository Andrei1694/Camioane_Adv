-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedFile_ownerId_createdAt_id_idx" ON "UploadedFile"("ownerId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "UploadedFile_createdAt_id_idx" ON "UploadedFile"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UploadedFile_storageProvider_storageKey_key" ON "UploadedFile"("storageProvider", "storageKey");

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
