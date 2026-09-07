-- ============================================
-- GORKA Supervisor Tables Migration (FIXED)
-- Date: August 15, 2026
-- FIXED: All UUID fields changed to TEXT to match Supabase
-- ============================================

-- 1. Agents table (extends users with agent-specific fields)
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supervisor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    max_debtors INT DEFAULT 50,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Agent Permissions (granular permissions per agent)
CREATE TABLE IF NOT EXISTS agent_permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    granted BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(agent_id, permission)
);

-- 3. Data Uploads (track structured/unstructured data uploads)
CREATE TABLE IF NOT EXISTS data_uploads (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'excel', 'json', 'txt')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    records_processed INT DEFAULT 0,
    processing_time INT,
    error_log TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- 4. Audit Logs (regulator-ready - all actions logged)
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    resource_id TEXT,
    details JSONB,
    ip_address TEXT,
    user_agent TEXT,
    compliance_tags TEXT[],
    data_location TEXT DEFAULT 'local-storage',
    created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Agent Assignments (track which debtors are assigned to which agents)
CREATE TABLE IF NOT EXISTS agent_assignments (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    debtor_id TEXT NOT NULL REFERENCES debtors(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'reassigned')),
    assigned_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    notes TEXT
);

-- 6. Supervisor Actions (audit trail of supervisor activities)
CREATE TABLE IF NOT EXISTS supervisor_actions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    supervisor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
    target_debtor_id TEXT REFERENCES debtors(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================

-- Agents indexes
CREATE INDEX IF NOT EXISTS idx_agents_organization_id ON agents(organization_id);
CREATE INDEX IF NOT EXISTS idx_agents_supervisor_id ON agents(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- Agent Permissions indexes
CREATE INDEX IF NOT EXISTS idx_agent_permissions_agent_id ON agent_permissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_permissions_granted ON agent_permissions(granted);

-- Data Uploads indexes
CREATE INDEX IF NOT EXISTS idx_data_uploads_organization_id ON data_uploads(organization_id);
CREATE INDEX IF NOT EXISTS idx_data_uploads_status ON data_uploads(status);
CREATE INDEX IF NOT EXISTS idx_data_uploads_created_at ON data_uploads(created_at);

-- Audit Logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource);

-- Agent Assignments indexes
CREATE INDEX IF NOT EXISTS idx_agent_assignments_agent_id ON agent_assignments(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_debtor_id ON agent_assignments(debtor_id);
CREATE INDEX IF NOT EXISTS idx_agent_assignments_status ON agent_assignments(status);

-- Supervisor Actions indexes
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_organization_id ON supervisor_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_supervisor_id ON supervisor_actions(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_supervisor_actions_created_at ON supervisor_actions(created_at);