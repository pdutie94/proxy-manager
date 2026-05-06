'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, Proxy, Node, CreateProxyRequest } from './api';

interface UseDataOptions<T> {
  onError?: (error: Error) => void;
}

// Generic data hook
function useData<T>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
  options?: UseDataOptions<T>
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error');
      setError(error);
      options?.onError?.(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    refetch();
  }, deps);

  return { data, loading, error, refetch };
}

// Proxies hook
export function useProxies(nodeId?: number, status?: string) {
  return useData<Proxy[]>(
    () => api.getProxies(nodeId, status),
    [nodeId, status]
  );
}

// Nodes hook
export function useNodes() {
  return useData<Node[]>(() => api.getNodes(), []);
}

// Create proxy hook
export function useCreateProxy() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (data: CreateProxyRequest): Promise<Proxy> => {
    setLoading(true);
    setError(null);
    try {
      const proxy = await api.createProxy(data);
      return proxy;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create proxy');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, loading, error };
}

// Delete proxy hook
export function useDeleteProxy() {
  const [loading, setLoading] = useState(false);

  const deleteProxy = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    try {
      await api.deleteProxy(id);
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteProxy, loading };
}

// Health hook
export function useHealth() {
  return useData(() => api.getHealth(), [], {
    onError: () => {}, // Silently fail for health check
  });
}
