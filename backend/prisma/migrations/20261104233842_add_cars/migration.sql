-- CreateTable
CREATE TABLE "Car" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plate" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CarInfo" (
    "carId" UUID NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,

    CONSTRAINT "CarInfo_pkey" PRIMARY KEY ("carId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Car_plate_key" ON "Car"("plate");

-- AddForeignKey
ALTER TABLE "CarInfo" ADD CONSTRAINT "CarInfo_carId_fkey" FOREIGN KEY ("carId") REFERENCES "Car"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Integrity checks (not expressible in the Prisma schema; keep them in future migrations)
-- Plates are stored normalized: uppercase letters and digits, without spaces or hyphens.
ALTER TABLE "Car" ADD CONSTRAINT "Car_plate_check" CHECK ("plate" ~ '^[A-Z0-9]{2,12}$');

ALTER TABLE "CarInfo" ADD CONSTRAINT "CarInfo_year_check" CHECK ("year" BETWEEN 1900 AND 2100);
ALTER TABLE "CarInfo" ADD CONSTRAINT "CarInfo_text_check" CHECK ("make" <> '' AND "model" <> '');
