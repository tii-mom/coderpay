-- Add provider-based, no-Android payment ingress.
CREATE TABLE "PaymentProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'custom_webhook',
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "channels" TEXT NOT NULL,
    "webhookSecret" TEXT NOT NULL,
    "secretPreview" TEXT NOT NULL,
    "configJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "PaymentProvider_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ProviderPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerId" TEXT NOT NULL,
    "orderId" TEXT,
    "providerTradeNo" TEXT NOT NULL,
    "outOrderNo" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProviderPayment_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "PaymentProvider" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProviderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PaymentProvider_userId_status_idx" ON "PaymentProvider"("userId", "status");
CREATE UNIQUE INDEX "ProviderPayment_providerId_providerTradeNo_key" ON "ProviderPayment"("providerId", "providerTradeNo");
CREATE INDEX "ProviderPayment_orderId_idx" ON "ProviderPayment"("orderId");

PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PaymentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'android_device',
    "sourceId" TEXT,
    "payType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "receivedAt" DATETIME NOT NULL,
    "matchStatus" TEXT NOT NULL,
    "matchedOrderId" TEXT,
    "confidence" INTEGER NOT NULL,
    "notificationHash" TEXT NOT NULL,
    "dedupeKey" TEXT,
    "rawNotification" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PaymentEvent" ("id", "deviceId", "sourceType", "sourceId", "payType", "amount", "receivedAt", "matchStatus", "matchedOrderId", "confidence", "notificationHash", "dedupeKey", "rawNotification", "createdAt")
SELECT "id", "deviceId", 'android_device', "deviceId", "payType", "amount", "receivedAt", "matchStatus", "matchedOrderId", "confidence", "notificationHash", "notificationHash", "rawNotification", "createdAt"
FROM "PaymentEvent";
DROP TABLE "PaymentEvent";
ALTER TABLE "new_PaymentEvent" RENAME TO "PaymentEvent";
PRAGMA foreign_keys=ON;

CREATE UNIQUE INDEX "PaymentEvent_notificationHash_key" ON "PaymentEvent"("notificationHash");
