-- CreateEnum
CREATE TYPE "CreditPurchaseStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "CreditTransactionType" AS ENUM ('PURCHASE', 'ADJUSTMENT', 'CAMPAIGN_DEBIT', 'REFUND');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creditBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CreditPurchase" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "credits" INTEGER NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "status" "CreditPurchaseStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerPaymentId" TEXT,
    "settledById" UUID,
    "settledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "amount" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "type" "CreditTransactionType" NOT NULL,
    "purchaseId" UUID,
    "createdById" UUID,
    "note" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditPurchase_userId_createdAt_id_idx" ON "CreditPurchase"("userId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "CreditPurchase_status_createdAt_id_idx" ON "CreditPurchase"("status", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "CreditPurchase_provider_providerPaymentId_key" ON "CreditPurchase"("provider", "providerPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditTransaction_purchaseId_key" ON "CreditTransaction"("purchaseId");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_id_idx" ON "CreditTransaction"("userId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_settledById_fkey" FOREIGN KEY ("settledById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "CreditPurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrity checks (not expressible in the Prisma schema; keep them in future migrations)
ALTER TABLE "User" ADD CONSTRAINT "User_creditBalance_check" CHECK ("creditBalance" >= 0);

ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_credits_check" CHECK ("credits" > 0);
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_amount_check"
  CHECK ("unitPriceMinor" > 0 AND "amountMinor" = "credits" * "unitPriceMinor");
ALTER TABLE "CreditPurchase" ADD CONSTRAINT "CreditPurchase_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_amount_check" CHECK ("amount" <> 0);
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_balance_check" CHECK ("balanceAfter" >= 0);
-- Purchase rows always reference their purchase, and only purchase rows do.
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_purchase_check"
  CHECK (("type" = 'PURCHASE') = ("purchaseId" IS NOT NULL));
