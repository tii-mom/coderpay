ALTER TABLE "Order" ADD COLUMN "confirmMode" TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE "Order" ADD COLUMN "manualConfirmedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "manualConfirmedBy" TEXT;
ALTER TABLE "Order" ADD COLUMN "manualConfirmNote" TEXT;
