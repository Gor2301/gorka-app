-- Create ServiceStatus table
CREATE TABLE IF NOT EXISTS "ServiceStatus" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "serviceName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "statusMessage" TEXT,
  "lastCheck" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "responseTime" INTEGER,
  UNIQUE("organizationId", "serviceName")
);

-- Create StatusHistory table
CREATE TABLE IF NOT EXISTS "StatusHistory" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "serviceName" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "responseTime" INTEGER,
  "recordedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_service_status_org ON "ServiceStatus"("organizationId");
CREATE INDEX IF NOT EXISTS idx_status_history_org_service ON "StatusHistory"("organizationId", "serviceName", "recordedAt");