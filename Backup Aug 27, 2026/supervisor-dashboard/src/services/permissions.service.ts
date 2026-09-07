const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api';

export const permissionsService = {
  async getRoles(token: string) {
    const response = await fetch(`${API_URL}/permissions/roles`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch permissions');
    }

    return response.json();
  },

  async updateRolePermissions(token: string, roleName: string, permissions: Record<string, boolean>) {
    // Convert from object to array of enabled permissions
    const enabledPermissions = Object.keys(permissions).filter(key => permissions[key] === true);

    const response = await fetch(`${API_URL}/permissions/roles/${roleName}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ permissions: enabledPermissions })
    });

    if (!response.ok) {
      throw new Error('Failed to update permissions');
    }

    return response.json();
  }
};