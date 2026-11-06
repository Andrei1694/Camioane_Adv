-- CreateEnum
CREATE TYPE "CarStatus" AS ENUM ('active', 'maintenance', 'inactive');

-- CreateEnum
CREATE TYPE "CarRoute" AS ENUM ('centru', 'nord', 'vest', 'est', 'sud');

-- CreateTable
CREATE TABLE "Car" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plate" VARCHAR(32) NOT NULL,
    "plateKey" VARCHAR(32) NOT NULL,
    "makeModel" VARCHAR(200) NOT NULL,
    "driverName" VARCHAR(200) NOT NULL DEFAULT '',
    "routeId" "CarRoute",
    "status" "CarStatus" NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Car_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Car_plateKey_key" ON "Car"("plateKey");
