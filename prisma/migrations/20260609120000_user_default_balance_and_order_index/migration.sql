
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" DATETIME,
    "emailVerifyTokenHash" TEXT,
    "emailVerifyExpiresAt" DATETIME,
    "passwordResetTokenHash" TEXT,
    "passwordResetExpiresAt" DATETIME,
    "feeBalance" REAL NOT NULL DEFAULT 0,
    "packageType" TEXT NOT NULL DEFAULT 'free',
    "freeOrderUsed" INTEGER NOT NULL DEFAULT 0,
    "subscriptionStartedAt" DATETIME,
    "subscriptionExpiresAt" DATETIME,
    "firstProDiscountUsed" BOOLEAN NOT NULL DEFAULT false,
    "firstMaxDiscountUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "email", "emailVerifiedAt", "emailVerifyExpiresAt", "emailVerifyTokenHash", "feeBalance", "firstMaxDiscountUsed", "firstProDiscountUsed", "freeOrderUsed", "id", "packageType", "passwordHash", "passwordResetExpiresAt", "passwordResetTokenHash", "subscriptionExpiresAt", "subscriptionStartedAt", "updatedAt") SELECT "createdAt", "email", "emailVerifiedAt", "emailVerifyExpiresAt", "emailVerifyTokenHash", "feeBalance", "firstMaxDiscountUsed", "firstProDiscountUsed", "freeOrderUsed", "id", "packageType", "passwordHash", "passwordResetExpiresAt", "passwordResetTokenHash", "subscriptionExpiresAt", "subscriptionStartedAt", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
DROP INDEX "Order_paymentCode_status_realAmountCents_expiresAt_idx";
CREATE INDEX "Order_paymentCodeId_status_realAmountCents_expiresAt_idx" ON "Order"("paymentCodeId", "status", "realAmountCents", "expiresAt");

