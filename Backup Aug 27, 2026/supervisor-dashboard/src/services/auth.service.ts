const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface LoginResponse {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      role: string;
      organizationId: string;
    };
    token: string;
  };
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();

    if (data.success && data.data.token) {
      localStorage.setItem('super_admin_token', data.data.token);
      localStorage.setItem('super_admin_user', JSON.stringify(data.data.user));
    }

    return data;
  },

  logout(): void {
    localStorage.removeItem('super_admin_token');
    localStorage.removeItem('super_admin_user');
  },

  getToken(): string | null {
    return localStorage.getItem('super_admin_token');
  },

  getUser(): any | null {
    const user = localStorage.getItem('super_admin_user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
};