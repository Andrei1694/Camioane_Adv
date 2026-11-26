-- CreateTable
CREATE TABLE "UserBilling" (
    "userId" UUID NOT NULL,
    "companyName" VARCHAR(200) NOT NULL,
    "cui" VARCHAR(12) NOT NULL,
    "address" VARCHAR(500) NOT NULL,
    "email" VARCHAR(254) NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "UserBilling_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "UserBilling" ADD CONSTRAINT "UserBilling_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
