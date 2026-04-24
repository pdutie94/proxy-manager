'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Proxy {
  id: number;
  port: number;
  protocol: 'HTTP' | 'SOCKS4' | 'SOCKS5';
  username?: string;
  password?: string;
  isActive: boolean;
  assignedTo?: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: number;
    email: string;
    name: string;
  };
  server: {
    id: number;
    name: string;
    host: string;
  };
}

interface Customer {
  id: number;
  email: string;
  name: string;
}

export default function ServerProxiesPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedProxy, setSelectedProxy] = useState<Proxy | null>(null);
  const [actionLoading, setActionLoading] = useState('');

  const serverId = parseInt(params.id as string);

  useEffect(() => {
    if (serverId) {
      fetchProxies();
      fetchCustomers();
    }
  }, [serverId]);

  const fetchProxies = async () => {
    try {
      const response = await api.get<{ proxies: Proxy[] }>(`/api/admin/servers/${serverId}/proxies`);
      setProxies(response.proxies);
    } catch (error) {
      console.error('Failed to fetch proxies:', error);
      setError('Failed to load proxies');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const response = await api.get<{ users: Customer[] }>('/api/admin/users');
      setCustomers(response.users);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    }
  };

  const createProxy = async (proxyData: any) => {
    setActionLoading('create');
    try {
      const response = await api.post<{ proxy: Proxy }>(`/api/admin/servers/${serverId}/proxies`, proxyData);
      setProxies(prev => [...prev, response.proxy]);
      setShowCreateForm(false);
      alert('Proxy created successfully');
    } catch (error) {
      console.error('Create proxy failed:', error);
      alert('Failed to create proxy');
    } finally {
      setActionLoading('');
    }
  };

  const deleteProxy = async (proxyId: number, port: number) => {
    if (!confirm('Are you sure you want to delete this proxy?')) {
      return;
    }

    setActionLoading(`delete-${proxyId}`);
    try {
      await api.delete(`/api/admin/servers/${serverId}/proxies/${port}`);
      setProxies(prev => prev.filter(p => p.id !== proxyId));
      alert('Proxy deleted successfully');
    } catch (error) {
      console.error('Delete proxy failed:', error);
      alert('Failed to delete proxy');
    } finally {
      setActionLoading('');
    }
  };

  const assignProxy = async (assignmentData: any) => {
    setActionLoading('assign');
    try {
      const response = await api.post<{ proxy: Proxy }>(`/api/admin/servers/${serverId}/proxies/assign`, assignmentData);
      
      // Update proxy in list
      setProxies(prev => prev.map(p => 
        p.id === response.proxy.id ? response.proxy : p
      ));
      
      setShowAssignForm(false);
      setSelectedProxy(null);
      alert('Proxy assigned successfully');
    } catch (error) {
      console.error('Assign proxy failed:', error);
      alert('Failed to assign proxy');
    } finally {
      setActionLoading('');
    }
  };

  const unassignProxy = async (proxyId: number) => {
    if (!confirm('Are you sure you want to unassign this proxy?')) {
      return;
    }

    setActionLoading(`unassign-${proxyId}`);
    try {
      const response = await api.request<{ proxy: Proxy }>(`/api/admin/servers/${serverId}/proxies/assign`, {
        method: 'DELETE',
        body: JSON.stringify({ proxyId })
      });
      
      // Update proxy in list
      setProxies(prev => prev.map(p => 
        p.id === response.proxy.id ? response.proxy : p
      ));
      
      alert('Proxy unassigned successfully');
    } catch (error) {
      console.error('Unassign proxy failed:', error);
      alert('Failed to unassign proxy');
    } finally {
      setActionLoading('');
    }
  };

  const getProtocolColor = (protocol: string) => {
    switch (protocol) {
      case 'HTTP':
        return 'bg-blue-100 text-blue-800';
      case 'SOCKS4':
        return 'bg-green-100 text-green-800';
      case 'SOCKS5':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/admin/servers')}
              className="text-blue-600 hover:text-blue-800"
            >
              Back to Servers
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Proxy Management</h1>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Add Proxy
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-600">{error}</div>
        </div>
      )}

      {/* Create Proxy Form */}
      {showCreateForm && (
        <CreateProxyForm
          onSubmit={createProxy}
          onCancel={() => setShowCreateForm(false)}
          loading={actionLoading === 'create'}
        />
      )}

      {/* Assign Proxy Form */}
      {showAssignForm && selectedProxy && (
        <AssignProxyForm
          proxy={selectedProxy}
          customers={customers}
          onSubmit={assignProxy}
          onCancel={() => {
            setShowAssignForm(false);
            setSelectedProxy(null);
          }}
          loading={actionLoading === 'assign'}
        />
      )}

      {/* Proxies List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {proxies.length === 0 ? (
          <div className="text-center py-12">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No proxies</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by adding your first proxy to this server.
            </p>
            <div className="mt-6">
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Add Proxy
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Port</th>
                  <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Protocol</th>
                  <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Auth</th>
                  <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Assigned</th>
                  <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">Expires</th>
                  <th className="px-3 lg:px-6 py-2 lg:py-3 text-right text-xs font-semibold text-gray-500 uppercase"></th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {proxies.map((proxy) => (
                  <tr key={proxy.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {proxy.port}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getProtocolColor(proxy.protocol)}`}>
                        {proxy.protocol}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {proxy.username ? 'Yes' : 'No'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        proxy.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {proxy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {proxy.customer ? (
                        <div>
                          <div className="font-medium text-gray-900">{proxy.customer.name}</div>
                          <div className="text-gray-500">{proxy.customer.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {proxy.expiresAt ? new Date(proxy.expiresAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {!proxy.assignedTo ? (
                          <button
                            onClick={() => {
                              setSelectedProxy(proxy);
                              setShowAssignForm(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Assign
                          </button>
                        ) : (
                          <button
                            onClick={() => unassignProxy(proxy.id)}
                            disabled={actionLoading.includes(`unassign-${proxy.id}`)}
                            className="text-orange-600 hover:text-orange-900 disabled:opacity-50"
                          >
                            {actionLoading.includes(`unassign-${proxy.id}`) ? 'Unassigning...' : 'Unassign'}
                          </button>
                        )}
                        <button
                          onClick={() => deleteProxy(proxy.id, proxy.port)}
                          disabled={actionLoading.includes(`delete-${proxy.id}`)}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          {actionLoading.includes(`delete-${proxy.id}`) ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Create Proxy Form Component
function CreateProxyForm({ onSubmit, onCancel, loading }: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    port: '',
    protocol: 'SOCKS5',
    username: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="mb-6 bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Create New Proxy</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Port *</label>
            <input
              type="number"
              required
              value={formData.port}
              onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="10001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Protocol *</label>
            <select
              value={formData.protocol}
              onChange={(e) => setFormData(prev => ({ ...prev, protocol: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="HTTP">HTTP</option>
              <option value="SOCKS4">SOCKS4</option>
              <option value="SOCKS5">SOCKS5</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username (optional)</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="proxy_user"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password (optional)</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="proxy_password"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Proxy'}
          </button>
        </div>
      </form>
    </div>
  );
}

// Assign Proxy Form Component
function AssignProxyForm({ proxy, customers, onSubmit, onCancel, loading }: {
  proxy: Proxy;
  customers: Customer[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [formData, setFormData] = useState({
    customerId: '',
    expiresAt: '',
    username: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      proxyId: proxy.id,
      ...formData,
    });
  };

  return (
    <div className="mb-6 bg-white shadow rounded-lg p-6">
      <h2 className="text-lg font-medium text-gray-900 mb-4">
        Assign Proxy {proxy.port} ({proxy.protocol})
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Customer *</label>
            <select
              required
              value={formData.customerId}
              onChange={(e) => setFormData(prev => ({ ...prev, customerId: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            >
              <option value="">Select a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} ({customer.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Expiry Date (optional)</label>
            <input
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Username (optional)</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Authentication username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password (optional)</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="Authentication password"
            />
          </div>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'Assigning...' : 'Assign Proxy'}
          </button>
        </div>
      </form>
    </div>
  );
}
