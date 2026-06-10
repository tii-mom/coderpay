-- Add adminNote field to User table
ALTER TABLE "User" ADD COLUMN "adminNote" TEXT;

-- Create AdminAuditLog table for tracking all admin operations
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
