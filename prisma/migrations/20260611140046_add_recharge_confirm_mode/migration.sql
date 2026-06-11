-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RechargeOrder" (
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
    "confirmMode" TEXT NOT NULL DEFAULT 'auto',
    CONSTRAINT "RechargeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RechargeOrder_paymentCodeId_fkey" FOREIGN KEY ("paymentCodeId") REFERENCES "PaymentCode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RechargeOrder" ("amount", "amountCents", "createdAt", "expiresAt", "id", "payTime", "payType", "paymentCodeId", "realAmount", "realAmountCents", "status", "userId") SELECT "amount", "amountCents", "createdAt", "expiresAt", "id", "payTime", "payType", "paymentCodeId", "realAmount", "realAmountCents", "status", "userId" FROM "RechargeOrder";
DROP TABLE "RechargeOrder";
ALTER TABLE "new_RechargeOrder" RENAME TO "RechargeOrder";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
