-- Additive-only reconciliation
-- Preserves existing tables and columns
-- Adds missing columns and tables to match Prisma schema

-- ─── ADD MISSING COLUMNS TO EXISTING TABLES ─────────────────────────────

-- organizations: add missing columns
ALTER TABLE "organizations" 
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
ADD COLUMN IF NOT EXISTS "taxId" TEXT,
ADD COLUMN IF NOT EXISTS "primaryContact" TEXT,
ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
ADD COLUMN IF NOT EXISTS "contactPhone" TEXT,
ADD COLUMN IF NOT EXISTS "clientType" TEXT,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- users: add missing columns
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "passwordHash" TEXT,
ADD COLUMN IF NOT EXISTS "organizationId" TEXT,
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "lastLogin" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- debtors: add missing columns
ALTER TABLE "debtors"
ADD COLUMN IF NOT EXISTS "totalDebt" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "daysOverdue" INTEGER,
ADD COLUMN IF NOT EXISTS "nextFollowUpDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextPaymentDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- actions: add missing columns
ALTER TABLE "actions"
ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN IF NOT EXISTS "triggerEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "emailTemplateId" TEXT,
ADD COLUMN IF NOT EXISTS "emailDelayHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "messageLogId" TEXT,
ADD COLUMN IF NOT EXISTS "triggerSms" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "smsTemplateId" TEXT,
ADD COLUMN IF NOT EXISTS "smsDelayHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- activity_logs: add missing columns
ALTER TABLE "activity_logs"
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- message_logs: add missing columns
ALTER TABLE "message_logs"
ADD COLUMN IF NOT EXISTS "jobId" TEXT,
ADD COLUMN IF NOT EXISTS "contactEmail" TEXT,
ADD COLUMN IF NOT EXISTS "contactName" TEXT,
ADD COLUMN IF NOT EXISTS "contentPreview" TEXT,
ADD COLUMN IF NOT EXISTS "providerData" JSONB,
ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "error" TEXT,
ADD COLUMN IF NOT EXISTS "templateId" TEXT,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- templates: add missing columns
ALTER TABLE "templates"
ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GENERAL',
ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "createdBy" TEXT,
ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ─── CREATE MISSING TABLES ──────────────────────────────────────────────

-- debts
CREATE TABLE IF NOT EXISTS "debts" (
    "id" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- calendar_events
CREATE TABLE IF NOT EXISTS "calendar_events" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "debtorId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TASK',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "source" TEXT,
    "sourceId" TEXT,
    "sourceDate" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "eventType" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "calendar_events_pkey" PRIMARY KEY ("id")
);

-- permission_roles
CREATE TABLE IF NOT EXISTS "permission_roles" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "organizationId" TEXT,
    "description" TEXT,
    "permissions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permission_roles_pkey" PRIMARY KEY ("id")
);

-- message_events
CREATE TABLE IF NOT EXISTS "message_events" (
    "id" TEXT NOT NULL,
    "messageLogId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_events_pkey" PRIMARY KEY ("id")
);

-- connectors
CREATE TABLE IF NOT EXISTS "connectors" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "config" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "connectors_pkey" PRIMARY KEY ("id")
);

-- external_enrichments
CREATE TABLE IF NOT EXISTS "external_enrichments" (
    "id" TEXT NOT NULL,
    "connectorId" TEXT NOT NULL,
    "debtorId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalScore" INTEGER,
    "riskLevel" TEXT,
    "externalStatus" TEXT,
    "retrievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "external_enrichments_pkey" PRIMARY KEY ("id")
);

-- ─── ADD MISSING INDEXES ────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_organizationId_idx" ON "users"("organizationId");
CREATE INDEX IF NOT EXISTS "debtors_organizationId_idx" ON "debtors"("organizationId");
CREATE INDEX IF NOT EXISTS "debts_debtorId_idx" ON "debts"("debtorId");
CREATE INDEX IF NOT EXISTS "actions_debtorId_idx" ON "actions"("debtorId");
CREATE INDEX IF NOT EXISTS "actions_assignedTo_idx" ON "actions"("assignedTo");
CREATE INDEX IF NOT EXISTS "actions_status_idx" ON "actions"("status");
CREATE INDEX IF NOT EXISTS "actions_dueDate_idx" ON "actions"("dueDate");
CREATE UNIQUE INDEX IF NOT EXISTS "message_logs_jobId_key" ON "message_logs"("jobId");
CREATE INDEX IF NOT EXISTS "message_logs_debtorId_idx" ON "message_logs"("debtorId");
CREATE INDEX IF NOT EXISTS "message_logs_status_idx" ON "message_logs"("status");
CREATE INDEX IF NOT EXISTS "message_logs_channel_idx" ON "message_logs"("channel");
CREATE INDEX IF NOT EXISTS "message_logs_createdAt_idx" ON "message_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "message_logs_contact_email_idx" ON "message_logs"("contactEmail");
CREATE INDEX IF NOT EXISTS "message_events_messageLogId_idx" ON "message_events"("messageLogId");
CREATE UNIQUE INDEX IF NOT EXISTS "templates_name_key" ON "templates"("name");
CREATE INDEX IF NOT EXISTS "activity_logs_organizationId_idx" ON "activity_logs"("organizationId");
CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "connectors_organizationId_idx" ON "connectors"("organizationId");
CREATE INDEX IF NOT EXISTS "external_enrichments_organizationId_expiresAt_idx" ON "external_enrichments"("organizationId", "expiresAt");
CREATE UNIQUE INDEX IF NOT EXISTS "external_enrichments_connectorId_debtorId_key" ON "external_enrichments"("connectorId", "debtorId");
CREATE INDEX IF NOT EXISTS "calendar_events_organizationId_idx" ON "calendar_events"("organizationId");
CREATE INDEX IF NOT EXISTS "calendar_events_startDate_idx" ON "calendar_events"("startDate");
CREATE UNIQUE INDEX IF NOT EXISTS "calendar_events_organizationId_eventType_debtorId_sourceDate_key" ON "calendar_events"("organizationId", "eventType", "debtorId", "sourceDate");
CREATE UNIQUE INDEX IF NOT EXISTS "permission_roles_role_key" ON "permission_roles"("role");