const API_URL = import.meta.env.VITE_API_URL || 'http://api.gorka.localhost:3000/api';

// Helper to get token
const getToken = () => localStorage.getItem('gorka_token');

export const permissionsService = {
  // ─── GET All Roles ──────────────────────────────────────────────────
  async getRoles() {
    const token = getToken();
    const response = await fetch(`${API_URL}/permissions/roles`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch roles: ${response.status}`);
    }

    return response.json();
  },

  // ─── GET Role Details ─────────────────────────────────────────────
  async getRole(roleName: string) {
    const token = getToken();
    const response = await fetch(`${API_URL}/permissions/roles/${roleName}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch role: ${response.status}`);
    }

    return response.json();
  },

  // ─── CREATE Role ──────────────────────────────────────────────────
  async createRole(data: { name: string; permissions: string[] }) {
    const token = getToken();
    const response = await fetch(`${API_URL}/permissions/roles`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to create role: ${response.status}`);
    }

    return response.json();
  },

  // ─── UPDATE Role ──────────────────────────────────────────────────
  async updateRole(roleName: string, data: { permissions: string[] }) {
    const token = getToken();
    const response = await fetch(`${API_URL}/permissions/roles/${roleName}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to update role: ${response.status}`);
    }

    return response.json();
  },

  // ─── DELETE Role ──────────────────────────────────────────────────
  async deleteRole(roleName: string) {
    const token = getToken();
    const response = await fetch(`${API_URL}/permissions/roles/${roleName}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete role: ${response.status}`);
    }

    return response.json();
  },

  // ─── GET User Permissions ─────────────────────────────────────────
  async getUserPermissions(userId: string) {
    const token = getToken();
    const response = await fetch(`${API_URL}/permissions/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user permissions: ${response.status}`);
    }

    return response.json();
  },

  // ─── UPDATE User Permissions ──────────────────────────────────────
  async updateUserPermissions(userId: string, data: { roles: string[] }) {
    const token = getToken();
    const response = await fetch(`${API_URL}/permissions/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Failed to update user permissions: ${response.status}`);
    }

    return response.json();
  },
};

export default permissionsService;