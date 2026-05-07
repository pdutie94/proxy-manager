'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Trash2, Clock, Shield, Globe, ExternalLink, RefreshCw, Copy, Check } from 'lucide-react';
import { api, Proxy, Node } from '@/lib/api';
import ActionDropdown from '@/components/ActionDropdown';
import Dropdown from '@/components/Dropdown';
import { useModal } from '@/components/ModalContainer';
import { useToast } from '@/components/Toast';

const ProxyPage: React.FC = () => {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterNode, setFilterNode] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const { addToast } = useToast();
  const { openConfirmModal, closeConfirmModal } = useModal();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [proxiesData, nodesData] = await Promise.all([
        api.getProxies(),
        api.getNodes()
      ]);
      setProxies(proxiesData);
      setNodes(nodesData as any);
    } catch (error) {
      console.error('Error fetching proxy data:', error);
      addToast({
        type: 'error',
        title: 'Lỗi tải dữ liệu',
        message: 'Không thể tải danh sách proxy hoặc node'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProxy = async () => {
    // In a real app, this would open a modal
    // For now, let's just show a toast or implement a simple creation if possible
    addToast({
      type: 'info',
      title: 'Tính năng đang phát triển',
      message: 'Vui lòng sử dụng API hoặc modal để tạo proxy (sẽ sớm hoàn thiện)'
    });
  };

  const handleDeleteProxy = async (proxy: Proxy) => {
    openConfirmModal({
      title: 'Xóa Proxy',
      message: `Bạn có chắc chắn muốn xóa proxy ${proxy.id}? Hành động này sẽ giải phóng port và IP ngay lập tức.`,
      onConfirm: async () => {
        try {
          await api.deleteProxy(proxy.id);
          addToast({
            type: 'success',
            title: 'Đã xóa',
            message: 'Proxy đã được xóa thành công'
          });
          fetchData();
          closeConfirmModal();
        } catch (error) {
          addToast({
            type: 'error',
            title: 'Lỗi',
            message: 'Không thể xóa proxy'
          });
          closeConfirmModal();
        }
      }
    });
  };

  const handleRenewProxy = async (proxy: Proxy) => {
    // Simple renewal for 30 more days
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    try {
      await api.renewProxy(proxy.id, nextMonth.toISOString());
      addToast({
        type: 'success',
        title: 'Đã gia hạn',
        message: 'Proxy đã được gia hạn thêm 30 ngày'
      });
      fetchData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Lỗi',
        message: 'Không thể gia hạn proxy'
      });
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    addToast({
      type: 'success',
      title: 'Đã sao chép',
      message: 'Thông tin proxy đã được lưu vào bộ nhớ tạm'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-orange-100 text-orange-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredProxies = proxies.filter(proxy => {
    const matchesSearch = 
      proxy.id.toString().includes(searchTerm) ||
      proxy.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      proxy.ipv6.includes(searchTerm);
    
    const matchesStatus = filterStatus === 'all' || proxy.status === filterStatus;
    const matchesNode = filterNode === 'all' || proxy.nodeId.toString() === filterNode;
    
    return matchesSearch && matchesStatus && matchesNode;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Proxy</h1>
          <p className="text-gray-600">Danh sách các proxy đang hoạt động trong hệ thống</p>
        </div>
        <button
          onClick={handleCreateProxy}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tạo Proxy mới
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col sm:flex-row flex-wrap gap-4">
        <div className="w-full sm:flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm theo ID, username, IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 h-10"
            />
          </div>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full sm:w-auto">
          <Dropdown
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Hoạt động' },
              { value: 'pending', label: 'Chờ xử lý' },
              { value: 'suspended', label: 'Tạm ngưng' },
              { value: 'expired', label: 'Hết hạn' }
            ]}
            className="flex-1 sm:w-48 sm:flex-none"
          />

          <Dropdown
            value={filterNode}
            onChange={setFilterNode}
            options={[
              { value: 'all', label: 'Tất cả Nodes' },
              ...nodes.map(n => ({ value: n.id.toString(), label: n.name }))
            ]}
            className="flex-1 sm:w-48 sm:flex-none"
          />

          <button 
            onClick={fetchData}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors h-10"
            title="Làm mới"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Table container with horizontal scroll */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Thông tin kết nối</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Xác thực</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Node</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Trạng thái</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Hết hạn</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProxies.map((proxy) => (
                <tr key={proxy.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-mono text-gray-900">{proxy.ipv6}:{proxy.port}</span>
                        <button 
                          onClick={() => copyToClipboard(`${proxy.ipv6}:${proxy.port}`, `ip-${proxy.id}`)}
                          className="text-gray-400 hover:text-blue-600"
                        >
                          {copiedId === `ip-${proxy.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <span className="text-xs text-gray-500 mt-1 flex items-center">
                        <Shield className="w-3 h-3 mr-1" /> SOCKS5
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{proxy.username}</div>
                      <div className="text-gray-500 font-mono text-xs">********</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="flex items-center">
                      <Globe className="w-4 h-4 mr-2 text-gray-400" />
                      Node {proxy.nodeId}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(proxy.status)}`}>
                      {proxy.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-2" />
                      {new Date(proxy.expiresAt).toLocaleDateString('vi-VN')}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ActionDropdown 
                      options={[
                        { 
                          key: 'copy', 
                          label: 'Copy Full Info', 
                          icon: <Copy className="w-4 h-4" />,
                          onClick: () => copyToClipboard(`${proxy.ipv6}:${proxy.port}:${proxy.username}:${proxy.password}`, proxy.id)
                        },
                        { 
                          key: 'renew', 
                          label: 'Gia hạn (30 ngày)', 
                          icon: <Clock className="w-4 h-4" />,
                          onClick: () => handleRenewProxy(proxy)
                        },
                        { 
                          key: 'delete', 
                          label: 'Xóa Proxy', 
                          icon: <Trash2 className="w-4 h-4" />,
                          onClick: () => handleDeleteProxy(proxy),
                          danger: true
                        }
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filteredProxies.length === 0 && (
          <div className="p-12 text-center text-gray-500">
            Không tìm thấy proxy nào khớp với tiêu chí tìm kiếm.
          </div>
        )}
      </div>
    </div>
  </div>
);
};

export default ProxyPage;
