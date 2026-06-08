ALTER TABLE "User" ADD COLUMN "freeOrderUsed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "subscriptionStartedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "subscriptionExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "firstProDiscountUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "firstMaxDiscountUsed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "User" SET "packageType" = 'pro' WHERE "packageType" IN ('starter', 'plan-elite');
UPDATE "User" SET "packageType" = 'max' WHERE "packageType" = 'plan-premium';

CREATE TABLE "RechargeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" REAL NOT NULL,
    "realAmount" REAL NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "realAmountCents" INTEGER NOT NULL,
    "payType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "payTime" DATETIME,
    "userId" TEXT NOT NULL,
    "paymentCodeId" TEXT,
    CONSTRAINT "RechargeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RechargeOrder_paymentCodeId_fkey" FOREIGN KEY ("paymentCodeId") REFERENCES "PaymentCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
