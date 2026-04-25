import { useAuthStore } from '@/stores/authStore';

// API client with automatic token refresh
class ApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || '';
  }

  private async getAccessToken(): Promise<string | null> {
    let token = localStorage.getItem('accessToken');
    
    if (!token) {
      const store = useAuthStore.getState();
      token = store.accessToken;
    }

    return token;
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      const refreshToken = localStorage.getItem('refreshToken') || 
                          useAuthStore.getState().refreshToken;
      
      if (!refreshToken) {
        return false;
      }

      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      
      // Update tokens in store and localStorage
      useAuthStore.getState().setTokens(data.accessToken, refreshToken);
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  }

  async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    // Always use relative URLs for Next.js API routes
    const fullUrl = url;
    
    // Get access token
    let accessToken = await this.getAccessToken();

    // Make initial request
    let response = await fetch(fullUrl, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
        ...options.headers,
      },
    });

    // If 401, try to refresh token and retry once
    if (response.status === 401 && !url.includes('/auth/refresh')) {
      const refreshSuccess = await this.refreshTokens();
      
      if (refreshSuccess) {
        // Get new token and retry
        accessToken = await this.getAccessToken();
        
        response = await fetch(fullUrl, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...options.headers,
          },
        });
      } else {
        // Refresh failed, logout user and redirect to login
        useAuthStore.getState().logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Authentication failed');
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // HTTP methods
  async get<T>(url: string, options?: Omit<RequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(url, { ...options, method: 'GET' });
  }

  async post<T>(url: string, data?: any, options?: Omit<RequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(url: string, data?: any, options?: Omit<RequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(url: string, data?: any, options?: Omit<RequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(url, {
      ...options,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(url: string, options?: Omit<RequestInit, 'body' | 'method'>): Promise<T> {
    return this.request<T>(url, { ...options, method: 'DELETE' });
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export typed methods for common use cases
export const api = {
  get: <T>(url: string, options?: Omit<RequestInit, 'body' | 'method'>) =>
    apiClient.get<T>(url, options),
  post: <T>(url: string, data?: any, options?: Omit<RequestInit, 'body' | 'method'>) =>
    apiClient.post<T>(url, data, options),
  put: <T>(url: string, data?: any, options?: Omit<RequestInit, 'body' | 'method'>) =>
    apiClient.put<T>(url, data, options),
  patch: <T>(url: string, data?: any, options?: Omit<RequestInit, 'body' | 'method'>) =>
    apiClient.patch<T>(url, data, options),
  delete: <T>(url: string, options?: Omit<RequestInit, 'body' | 'method'>) =>
    apiClient.delete<T>(url, options),
  request: <T>(url: string, options?: RequestInit) =>
    apiClient.request<T>(url, options),
};
