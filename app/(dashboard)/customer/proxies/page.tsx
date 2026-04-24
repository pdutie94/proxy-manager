'use client';

import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Proxy {
  id: number;
  port: number;
  protocol: string;
  username?: string;
  password?: string;
  connectionString: string;
  expiresAt?: string;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string;
  server: {
    id: number;
    name: string;
    host: string;
  };
}

export default function CustomerProxies() {
  const { user } = useAuthStore();
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProxies = async () => {
      try {
        const response = await api.get<{ proxies: any[]; total: number }>('/api/customer/proxies');
        setProxies(response.proxies);
      } catch (error) {
        console.error('Failed to fetch proxies:', error);
        setError('Failed to load proxies');
      } finally {
        setLoading(false);
      }
    };

    fetchProxies();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getConnectionString = (proxy: Proxy) => {
    return proxy.connectionString;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Proxies</h1>
        <p className="mt-2 text-gray-600">
          Manage and view your assigned proxy connections.
        </p>
      </div>

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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No proxies assigned</h3>
          <p className="mt-1 text-sm text-gray-500">
            You don't have any proxy servers assigned to your account yet.
          </p>
          <p className="mt-2 text-sm text-gray-500">
            Please contact your administrator to get proxy access.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {proxies.map((proxy) => (
              <li key={proxy.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900">
                          {proxy.server.name} - {proxy.protocol} :{proxy.port}
                        </p>
                        <span
                          className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                            proxy.isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {proxy.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Server: {proxy.server.host}
                      </p>
                      {proxy.expiresAt && (
                        <p className="mt-1 text-sm text-gray-500">
                          Expires: {new Date(proxy.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                      <div className="mt-2">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {getConnectionString(proxy)}
                        </code>
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <button
                        onClick={() => copyToClipboard(getConnectionString(proxy))}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">How to use your proxy</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ol className="list-decimal list-inside space-y-1">
                <li>Copy the connection string using the Copy button</li>
                <li>Configure your browser or application to use the proxy</li>
                <li>Enter the connection string in your proxy settings</li>
                <li>If authentication is required, use the provided username and password</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
