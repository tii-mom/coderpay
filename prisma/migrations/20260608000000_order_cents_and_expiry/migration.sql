-- Add cents-backed money fields and explicit expiry.
ALTER TABLE "Order" ADD COLUMN "amountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "realAmountCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN "expiresAt" DATETIME;

-- Backfill old rows from legacy floating amounts.
UPDATE "Order"
SET
  "amountCents" = CAST(ROUND("amount" * 100) AS INTEGER),
  "realAmountCents" = CAST(ROUND("realAmount" * 100) AS INTEGER);

-- SQLite datetime modifier accepts a string such as '+5 minutes'.
UPDATE "Order"
SET "expiresAt" = datetime(
  "createdAt",
  '+' || COALESCE((SELECT "expireMinutes" FROM "App" WHERE "App"."id" = "Order"."appId"), 5) || ' minutes'
)
WHERE "expiresAt" IS NULL;

CREATE INDEX "Order_paymentCode_status_realAmountCents_expiresAt_idx"
ON "Order"("paymentCodeId", "status", "realAmountCents", "expiresAt");
