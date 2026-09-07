import React, { useState, useEffect } from 'react';
import { permissionsService } from '../services/permissions.service';

interface RolePermission {
  name: string;
  permissions: Record<string, boolean>;
}

const Permissions: React.FC = () => {
  const [roles, setRoles] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  // Map permission keys to display names
  const permissionDisplayNames: Record<string, string> = {
    'VIEW_DEBTORS': 'View Debtors',
    'CREATE_DEBTOR': 'Create Debtor',
    'UPDATE_DEBTOR': 'Update Debtor',
    'DELETE_DEBTOR': 'Delete Debtor',
    'VIEW_AGENTS': 'View Agents',
    'CREATE_AGENT': 'Create Agent',
    'UPDATE_AGENT': 'Update Agent',
    'DELETE_AGENT': 'Delete Agent',
    'VIEW_AUDIT': 'View Audit Logs',
    'EXPORT_AUDIT': 'Export Audit Logs',
    'VIEW_COMPLIANCE': 'View Compliance',
    'VIEW_DATA_FLOW': 'View Data Flow',
    'MANAGE_CONNECTORS': 'Manage Connectors',
    'VIEW_CONNECTORS': 'View Connectors',
    'MANAGE_SETTINGS': 'Manage Settings',
    'VIEW_SETTINGS': 'View Settings',
    'MANAGE_CALENDAR': 'Manage Calendar',
    'VIEW_CALENDAR': 'View Calendar'
  };

  useEffect(() => {
    fetchPermissions();
  }, []);

  const fetchPermissions = async () => {
    const token = localStorage.getItem('supervisor_token') || localStorage.getItem('token');
    console.log('Token:', token);
    
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await permissionsService.getRoles(token);
      console.log('Data:', response);
      
      // Transform the data from array format to object format
      const transformedRoles = response.data.map((item: any) => {
        // Convert array of permissions to object with true values
        const permissionsObj: Record<string, boolean> = {};
        item.permissions.forEach((perm: string) => {
          permissionsObj[perm] = true;
        });
        
        return {
          name: item.role,
          permissions: permissionsObj
        };
      });
      
      setRoles(transformedRoles);
    } catch (err: any) {
      console.error('Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (roleName: string, permission: string, currentValue: boolean) => {
    const token = localStorage.getItem('supervisor_token') || localStorage.getItem('token');
    if (!token) return;

    // Update local state immediately
    const updatedRoles = roles.map(role => {
      if (role.name === roleName) {
        return {
          ...role,
          permissions: {
            ...role.permissions,
            [permission]: !currentValue
          }
        };
      }
      return role;
    });
    setRoles(updatedRoles);

    // Show saving indicator
    setSaving(prev => ({ ...prev, [`${roleName}-${permission}`]: true }));

    try {
      // Find the role and get all permissions
      const role = updatedRoles.find(r => r.name === roleName);
      if (!role) return;

      // Save to backend
      await permissionsService.updateRolePermissions(token, roleName, role.permissions);
      console.log(`Saved ${roleName} permissions`);
    } catch (err) {
      console.error('Save error:', err);
      // Revert on error
      await fetchPermissions();
    } finally {
      setSaving(prev => ({ ...prev, [`${roleName}-${permission}`]: false }));
    }
  };

  if (loading) return <div style={{ padding: '20px' }}>Loading permissions...</div>;
  if (error) return <div style={{ padding: '20px', color: 'red' }}>Error: {error}</div>;
  if (roles.length === 0) return <div style={{ padding: '20px' }}>No permissions found</div>;

  // Get all unique permission names from the first role
  const allPermissions = Object.keys(roles[0].permissions).sort();

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, color: '#111111', marginBottom: '8px' }}>
          Staff Roles & Permissions
        </h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          Manage roles and control what each role can access
        </p>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          style={{ 
            padding: '8px 16px', 
            background: '#7C3AED', 
            color: 'white', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer',
            fontSize: '14px'
          }}
          onClick={() => fetchPermissions()}
        >
          Refresh Permissions
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid #ddd', fontWeight: 600 }}>
                Permissions
              </th>
              {roles.map((role) => (
                <th key={role.name} style={{ textAlign: 'center', padding: '12px', borderBottom: '2px solid #ddd', fontWeight: 600 }}>
                  {role.name.replace('_', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allPermissions.map((permission) => {
              const displayName = permissionDisplayNames[permission] || permission;
              return (
                <tr key={permission} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{displayName}</td>
                  {roles.map((role) => {
                    const isChecked = role.permissions[permission] || false;
                    const isSaving = saving[`${role.name}-${permission}`] || false;
                    return (
                      <td key={`${role.name}-${permission}`} style={{ textAlign: 'center', padding: '10px 12px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggle(role.name, permission, isChecked)}
                          disabled={isSaving}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        {isSaving && <span style={{ marginLeft: '4px', fontSize: '10px', color: '#999' }}>...</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Permissions;