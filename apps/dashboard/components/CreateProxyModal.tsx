'use client';

import React, { useState, useEffect } from 'react';
import { X, Server, Clock, Hash } from 'lucide-react';
import { api, Node } from '@/lib/api';

interface CreateProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { count: number; nodeId?: number; expiresAt?: string }) => Promise<void>;
}

const CreateProxyModal: React.FC<CreateProxyModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [loading, setLoading] = useState(false);
  const [nodes, setNodes] = useState<Node[]>([]);
  
  const [count, setCount] = useState<number>(1);
  const [nodeId, setNodeId] = useState<string>('auto');
  const [durationDays, setDurationDays] = useState<number>(30);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      fetchNodes();
    } else {
      document.body.style.overflow = 'unset';
      // Reset form
      setCount(1);
      setNodeId('auto');
      setDurationDays(30);
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const fetchNodes = async () => {
    try {
      const data = await api.getNodes('ACTIVE');
      setNodes(data as any);
    } catch (error) {
      console.error('Error fetching nodes:', error);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    setLoading(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);

      await onSubmit({
        count,
        nodeId: nodeId === 'auto' ? undefined : parseInt(nodeId),
        expiresAt: expiresAt.toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={!loading ? onClose : undefined}></div>
        </div>

        <span className="hidden sm:inline-block sm:h-screen sm:align-middle" aria-hidden="true">&#8203;</span>

        <div className="inline-block transform overflow-hidden rounded-lg bg-white text-left align-bottom shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:align-middle">
          <div className="bg-white px-4 pb-4 pt-5 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 mb-4">
              <h3 className="text-lg font-semibold leading-6 text-gray-900">
                Tạo Proxy Mới
              </h3>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
                onClick={onClose}
                disabled={loading}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} id="create-proxy-form" className="space-y-4">
              {nodes.length === 0 && !loading && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-md p-3 text-sm mb-4">
                  Hệ thống hiện không có Node nào đang hoạt động. Vui lòng thêm Node trước khi tạo Proxy!
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Hash className="w-4 h-4 mr-2 text-gray-400" />
                  Số lượng Proxy
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  value={count}
                  onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                  disabled={loading || nodes.length === 0}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Nhập số lượng proxy bạn muốn tạo (tối đa 1000 proxy mỗi lần).
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Server className="w-4 h-4 mr-2 text-gray-400" />
                  Chọn Node
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  value={nodeId}
                  onChange={(e) => setNodeId(e.target.value)}
                  disabled={loading || nodes.length === 0}
                >
                  <option value="auto">Tự động chọn Node (Tối ưu nhất)</option>
                  {nodes.map(node => (
                    <option key={node.id} value={node.id}>
                      {node.name} - {node.ipAddress}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Clock className="w-4 h-4 mr-2 text-gray-400" />
                  Thời hạn
                </label>
                <select
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100 disabled:text-gray-500"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value))}
                  disabled={loading || nodes.length === 0}
                >
                  <option value={7}>7 ngày</option>
                  <option value={30}>30 ngày (1 tháng)</option>
                  <option value={90}>90 ngày (3 tháng)</option>
                  <option value={180}>180 ngày (6 tháng)</option>
                  <option value={365}>365 ngày (1 năm)</option>
                </select>
              </div>
            </form>
          </div>
          
          <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
            <button
              type="submit"
              form="create-proxy-form"
              disabled={loading || nodes.length === 0}
              className="inline-flex w-full justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 sm:ml-3 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 mt-0.5"></div>
                  Đang tạo...
                </>
              ) : 'Tạo Proxy'}
            </button>
            <button
              type="button"
              className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
              onClick={onClose}
              disabled={loading}
            >
              Hủy
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateProxyModal;
