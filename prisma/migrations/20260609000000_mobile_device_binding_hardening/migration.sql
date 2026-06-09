ALTER TABLE "Device" ADD COLUMN "bindingExpiresAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "boundAt" DATETIME;

UPDATE "Device"
SET "boundAt" = "updatedAt"
WHERE "deviceSecret" IS NOT NULL AND "deviceSecret" != '' AND "boundAt" IS NULL;

UPDATE "Device"
SET "bindingExpiresAt" = datetime('now', '+24 hours')
WHERE ("deviceSecret" IS NULL OR "deviceSecret" = '') AND "bindingExpiresAt" IS NULL;
