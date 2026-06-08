ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "emailVerifyTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifyExpiresAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "passwordResetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetExpiresAt" DATETIME;

-- Existing production accounts predate email verification; keep them usable.
UPDATE "User"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", CURRENT_TIMESTAMP);

CREATE INDEX "User_emailVerifyTokenHash_idx" ON "User"("emailVerifyTokenHash");
CREATE INDEX "User_passwordResetTokenHash_idx" ON "User"("passwordResetTokenHash");
