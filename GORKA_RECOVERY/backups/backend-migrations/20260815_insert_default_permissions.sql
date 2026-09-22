 
-- ============================================
-- Default Permissions for Agents
-- Date: August 15, 2026
-- Description: List of all possible permissions
-- that can be assigned to agents
-- ============================================

-- Get the default permission list
-- These are the permissions that will be assigned
-- to new agents when they are created

CREATE OR REPLACE FUNCTION get_default_agent_permissions()
RETURNS TABLE(permission_name text, default_granted boolean) AS $$
BEGIN
    RETURN QUERY VALUES
        ('can_view_debtors', true),
        ('can_send_sms', true),
        ('can_make_calls', true),
        ('can_send_emails', true),
        ('can_send_push', true),
        ('can_view_assigned_only', true),
        ('can_delete_debtors', false),
        ('can_export_data', false),
        ('can_view_financials', false),
        ('can_edit_debtors', false),
        ('can_assign_debtors', false);
END;
$$ LANGUAGE plpgsql;

-- This function will be used when creating new agents
-- Note: Actual permissions are assigned per agent during creation