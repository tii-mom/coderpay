ALTER TABLE "User" ADD COLUMN "inviteCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referredByUserId" TEXT;
ALTER TABLE "User" ADD COLUMN "referredAt" DATETIME;

CREATE UNIQUE INDEX "User_inviteCode_key" ON "User"("inviteCode");
CREATE INDEX "User_referredByUserId_idx" ON "User"("referredByUserId");

CREATE TABLE "ReferralReward" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "rechargeOrderId" TEXT NOT NULL,
  "invitedUserId" TEXT NOT NULL,
  "beneficiaryUserId" TEXT NOT NULL,
  "depth" INTEGER NOT NULL,
  "tier" TEXT NOT NULL,
  "rateBps" INTEGER NOT NULL,
  "baseAmountCents" INTEGER NOT NULL,
  "rewardCents" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "creditedAt" DATETIME,
  CONSTRAINT "ReferralReward_beneficiaryUserId_fkey" FOREIGN KEY ("beneficiaryUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReferralReward_rechargeOrderId_beneficiaryUserId_depth_key" ON "ReferralReward"("rechargeOrderId", "beneficiaryUserId", "depth");
CREATE INDEX "ReferralReward_beneficiaryUserId_createdAt_idx" ON "ReferralReward"("beneficiaryUserId", "createdAt");
CREATE INDEX "ReferralReward_invitedUserId_idx" ON "ReferralReward"("invitedUserId");
