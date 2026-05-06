const API_BASE_URL = 'http://localhost:3001/api';

// Types
export interface Proxy {
  id: string;
  nodeId: number;
  ipv6: string;
  port: number;
  username: string;
  password: string;
  status: 'pending' | 'active' | 'suspended' | 'expired';
  expiresAt: string;
  createdAt: string;
}

export interface Node {
  id: number;
  name: string;
  ipAddress: string;
  region: string;
  ipv6Subnet: string;
  maxPorts: number;
  status: 'active' | 'inactive' | 'maintenance';
  lastHeartbeatAt: string | null;
  freePorts: number;
  activeProxies: number;
}

export interface CreateProxyRequest {
  userId: number;
  nodeId?: number;
  expiresAt?: string;
  idempotencyKey?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// API Client
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({
          message: `HTTP ${response.status}: ${response.statusText}`,
          statusCode: response.status,
        }));
        throw new Error(error.message || `Request failed: ${response.status}`);
      }

      // Handle empty responses
      if (response.status === 204) {
        return null as T;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network error');
    }
  }

  // Proxies
  async getProxies(nodeId?: number, status?: string): Promise<Proxy[]> {
    const params = new URLSearchParams();
    if (nodeId) params.append('nodeId', nodeId.toString());
    if (status) params.append('status', status);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request<Proxy[]>(`/proxies${query}`);
  }

  async getProxy(id: string): Promise<Proxy> {
    return this.request<Proxy>(`/proxies/${id}`);
  }

  async createProxy(data: CreateProxyRequest): Promise<Proxy> {
    return this.request<Proxy>('/proxies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteProxy(id: string): Promise<void> {
    return this.request<void>(`/proxies/${id}`, {
      method: 'DELETE',
    });
  }

  async renewProxy(id: string, expiresAt: string): Promise<Proxy> {
    return this.request<Proxy>(`/proxies/${id}/renew`, {
      method: 'POST',
      body: JSON.stringify({ expiresAt }),
    });
  }

  // Nodes

  // Health
  async getHealth(): Promise<any> {
    return this.request('/health');
  }

  // Dashboard
  async getDashboardOverview(): Promise<{
    activeProxies: number;
    activeProxiesChange: number;
    pendingApplication: number;
    pendingApplicationPercentage: number;
    onlineNodes: number;
    totalNodes: number;
    onlineNodesPercentage: number;
    redisQueue: number;
    lastUpdated: string;
    systemActive: boolean;
  }> {
    return this.request('/dashboard/overview');
  }

  async getNodesStatus(): Promise<Array<{
    id: string;
    name: string;
    proxyCount: number;
    utilization: number;
    status: 'online' | 'offline' | 'warning';
  }>> {
    return this.request('/dashboard/nodes-status');
  }

  async getSystemStatus(): Promise<Array<{
    name: string;
    status: 'active' | 'connected' | 'pending' | 'running';
    description: string;
    value?: number;
  }>> {
    return this.request('/dashboard/system-status');
  }

  async getRecentEvents(): Promise<Array<{
    id: string;
    type: 'CREATE_PROXY' | 'DELETE_PROXY' | 'RENEW_PROXY' | 'EXPIRED_PROXY';
    title: string;
    node: string;
    time: string;
    status: 'applied' | 'pending' | 'warning';
    timestamp: string;
  }>> {
    return this.request('/dashboard/recent-events');
  }

  async getAlerts(): Promise<Array<{
    id: string;
    type: 'warning' | 'error' | 'info';
    title: string;
    message: string;
    time: string;
    timestamp: string;
  }>> {
    return this.request('/dashboard/alerts');
  }

  // Nodes Management
  async getNodes(status?: string): Promise<Array<{
    id: number;
    name: string;
    host: string;
    ipAddress: string;
    region: {
      id: number;
      name: string;
    } | null;
    status: 'ONLINE' | 'OFFLINE' | 'ERROR' | 'PENDING';
    maxPorts: number;
    ipv6Subnet?: string;
    lastChecked?: string;
    createdAt: string;
    updatedAt: string;
    proxyCount: number;
    activeProxyCount: number;
    _count: {
      ports: number;
      proxies: number;
    };
  }>> {
    const endpoint = status ? `/nodes?status=${status}` : '/nodes';
    return this.request(endpoint);
  }

  async getNode(id: number): Promise<any> {
    return this.request(`/nodes/${id}`);
  }

  async createNode(nodeData: any): Promise<any> {
    return this.request('/nodes', {
      method: 'POST',
      body: JSON.stringify(nodeData),
    });
  }

  async updateNode(id: number, nodeData: any): Promise<any> {
    return this.request(`/nodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(nodeData),
    });
  }

  async deleteNode(id: number): Promise<any> {
    return this.request(`/nodes/${id}`, {
      method: 'DELETE',
    });
  }

  async checkNode(id: number): Promise<any> {
    return this.request(`/nodes/${id}/check`, {
      method: 'POST',
    });
  }

  async initializeNode(id: number): Promise<{
    node: any;
    initResult: {
      success: boolean;
      message: string;
      details?: any;
    };
  }> {
    return this.request(`/nodes/${id}/initialize`, {
      method: 'POST',
    });
  }

  async getNodeStats(id: number): Promise<any> {
    return this.request(`/nodes/${id}/stats`);
  }

  // Regions Management
  async getRegions(isActive?: string): Promise<Array<{
    id: number;
    name: string;
    description?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    _count: {
      nodes: number;
    };
  }>> {
    const endpoint = isActive ? `/regions?isActive=${isActive}` : '/regions';
    return this.request(endpoint);
  }

  async getRegion(id: number): Promise<any> {
    return this.request(`/regions/${id}`);
  }

  async createRegion(regionData: any): Promise<any> {
    return this.request('/regions', {
      method: 'POST',
      body: JSON.stringify(regionData),
    });
  }

  async updateRegion(id: number, regionData: any): Promise<any> {
    return this.request(`/regions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(regionData),
    });
  }

  async deleteRegion(id: number): Promise<any> {
    return this.request(`/regions/${id}`, {
      method: 'DELETE',
    });
  }

  async getRegionStats(id: number): Promise<any> {
    return this.request(`/regions/${id}/stats`);
  }
}

export const api = new ApiClient(API_BASE_URL);
