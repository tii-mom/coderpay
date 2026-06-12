CREATE TABLE "SystemNotice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "level" TEXT NOT NULL DEFAULT 'info',
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "startsAt" DATETIME,
  "endsAt" DATETIME,
  "createdBy" TEXT,
  "updatedBy" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SystemNotice_enabled_startsAt_endsAt_idx"
ON "SystemNotice"("enabled", "startsAt", "endsAt");
