'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Eye, Power, PowerOff, Settings, Terminal, Shield, Activity, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { api } from '@/lib/api';
import Dropdown from '@/components/Dropdown';
import ActionDropdown from '@/components/ActionDropdown';
import { useModal } from '@/components/ModalContainer';
import { useToast } from '@/components/Toast';
import Initialize3ProxyModal from '@/components/Initialize3ProxyModal';

// Use the same Node type as API response
type Node = Awaited<ReturnType<typeof api.getNodes>>[0];

const NodesPage: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalLoading, setModalLoading] = useState(false);
  const [initializeModalOpen, setInitializeModalOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const { addToast } = useToast();
  const { openNodeModal, openConfirmModal } = useModal();

  useEffect(() => {
    fetchNodes();
  }, []);

  const fetchNodes = async () => {
    try {
      const nodesData = await api.getNodes();
      setNodes(nodesData);
    } catch (error) {
      console.error('Error fetching nodes:', error);
      // Fallback to empty array if API fails
      setNodes([]);
    } finally {
      setLoading(false);
    }
  };

  // CRUD Operations
  const handleCreateNode = async (nodeData: any) => {
    setModalLoading(true);
    try {
      await api.createNode(nodeData);
      await fetchNodes();
    } catch (error) {
      console.error('Error creating node:', error);
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditNode = async (nodeData: any, node: Node) => {
    setModalLoading(true);
    try {
      await api.updateNode(node.id, nodeData);
      await fetchNodes();
    } catch (error) {
      console.error('Error updating node:', error);
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteNode = async (node: Node) => {
    setModalLoading(true);
    try {
      await api.deleteNode(node.id);
      await fetchNodes();
    } catch (error) {
      console.error('Error deleting node:', error);
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleCheckNode = async (node: Node) => {
    try {
      await api.checkNode(node.id);
      await fetchNodes();
    } catch (error) {
      console.error('Error checking node:', error);
    }
  };

  const handleConfigure3Proxy = async (node: Node) => {
    try {
      await api.initializeNode(node.id);
    } catch (error) {
      console.error('Error configuring 3Proxy:', error);
    }
    setSelectedNode(node);
    setInitializeModalOpen(true);
  };

  const handleTestConnection = async (node: Node) => {
    try {
      addToast({
        type: 'info',
        title: 'Đang kiểm tra kết nối',
        message: `Đang kiểm tra kết nối đến node "${node.name}"...`
      });
      
      await api.checkNode(node.id);
      await fetchNodes();
      
      addToast({
        type: 'success',
        title: 'Kiểm tra thành công',
        message: `Kết nối đến node "${node.name}" đã được kiểm tra thành công`
      });
    } catch (error) {
      console.error('Error testing connection:', error);
      addToast({
        type: 'error',
        title: 'Kiểm tra thất bại',
        message: `Không thể kiểm tra kết nối đến node "${node.name}"`
      });
    }
  };

  const handleViewLogs = (node: Node) => {
    // TODO: Open logs modal
    addToast({
      type: 'info',
      title: 'Tính năng đang phát triển',
      message: `Xem logs cho node "${node.name}" sẽ có sẵn trong phiên bản tiếp theo`
    });
  };

  const handleInitializeNode = async (node: Node) => {
    try {
      console.log('=== Frontend: handleInitializeNode called ===', { nodeId: node.id, nodeName: node.name });
      
      addToast({
        type: 'info',
        title: 'Đang khởi tạo',
        message: `Đang khởi tạo node "${node.name}"...`
      });
      
      // Call actual initialize node API
      const response = await api.initializeNode(node.id);
      console.log('=== Frontend: API response received ===', response);
      
      if (response.initResult?.success) {
        console.log('=== Frontend: Success case, showing success toast ===');
        addToast({
          type: 'success',
          title: 'Khởi tạo thành công',
          message: `Node "${node.name}" đã được khởi tạo thành công`
        });
      } else {
        console.log('=== Frontend: Failure case, showing error toast ===', {
          success: response.initResult?.success,
          message: response.initResult?.message
        });
        addToast({
          type: 'error',
          title: 'Khởi tạo thất bại',
          message: response.initResult?.message || `Không thể khởi tạo node "${node.name}"`
        });
      }
      
      await fetchNodes();
    } catch (error) {
      console.error('=== Frontend: Exception in handleInitializeNode ===', error);
      addToast({
        type: 'error',
        title: 'Khởi tạo thất bại',
        message: `Không thể khởi tạo node "${node.name}"`
      });
    }
  };

  const handleToggleNode = async (node: Node) => {
    try {
      addToast({
        type: 'info',
        title: 'Tính năng đang phát triển',
        message: `Toggle status cho node "${node.name}" sẽ có sẵn trong phiên bản tiếp theo`
      });
    } catch (error) {
      console.error('Error toggling node:', error);
    }
  };

  const handleRefreshNode = async (node: Node) => {
    try {
      addToast({
        type: 'info',
        title: 'Đang làm mới',
        message: `Đang làm mới thông tin node "${node.name}"...`
      });
      
      await api.checkNode(node.id);
      await fetchNodes();
      
      addToast({
        type: 'success',
        title: 'Làm mới thành công',
        message: `Thông tin node "${node.name}" đã được cập nhật`
      });
    } catch (error) {
      console.error('Error refreshing node:', error);
      addToast({
        type: 'error',
        title: 'Làm mới thất bại',
        message: `Không thể làm mới thông tin node "${node.name}"`
      });
    }
  };

  const getSecondaryActionOptions = (node: Node) => [
    {
      key: 'configure-3proxy',
      label: 'Cấu hình 3Proxy',
      icon: <Settings className="w-4 h-4" />,
      onClick: () => handleConfigure3Proxy(node),
    },
    {
      key: 'initialize-node',
      label: 'Khởi tạo Node',
      icon: <Terminal className="w-4 h-4" />,
      onClick: () => handleInitializeNode(node),
    },
    {
      key: 'view-logs',
      label: 'Xem Logs',
      icon: <Eye className="w-4 h-4" />,
      onClick: () => handleViewLogs(node),
    },
    {
      key: 'refresh',
      label: 'Làm mới',
      icon: <RefreshCw className="w-4 h-4" />,
      onClick: () => handleRefreshNode(node),
    },
    {
      key: 'divider1',
      label: '',
      icon: null,
      onClick: () => {},
      divider: true,
    },
    {
      key: 'edit',
      label: 'Chỉnh sửa',
      icon: <Edit className="w-4 h-4" />,
      onClick: () => openEditModal(node),
    },
    {
      key: 'delete',
      label: 'Xóa',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => openDeleteModal(node),
      danger: true,
    },
  ];

  // Modal handlers
  const openCreateModal = () => {
    openNodeModal(undefined, handleCreateNode);
  };

  const openEditModal = (node: Node) => {
    openNodeModal(node, (data) => handleEditNode(data, node));
  };

  const openDeleteModal = (node: Node) => {
    openConfirmModal({
      title: 'Xóa Node',
      message: `Bạn có chắc chắn muốn xóa node "${node.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: () => handleDeleteNode(node),
      loading: modalLoading,
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-green-100 text-green-800';
      case 'OFFLINE':
        return 'bg-gray-100 text-gray-800';
      case 'ERROR':
        return 'bg-red-100 text-red-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'ONLINE':
        return 'bg-green-500';
      case 'OFFLINE':
        return 'bg-gray-400';
      case 'ERROR':
        return 'bg-red-500';
      case 'PENDING':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const filteredNodes = nodes.filter(node => {
    const matchesSearch = node.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.host.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         node.ipAddress.includes(searchTerm);
    const matchesFilter = filterStatus === 'all' || node.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Nodes</h1>
          <p className="text-gray-600">Quản lý các node proxy trong hệ thống</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Thêm Node
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start">
            <div className="p-2 bg-green-100 rounded-lg">
              <Power className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Online</p>
              <p className="text-2xl font-bold text-gray-900">
                {nodes.filter(n => n.status === 'ONLINE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start">
            <div className="p-2 bg-gray-100 rounded-lg">
              <PowerOff className="w-6 h-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Offline</p>
              <p className="text-2xl font-bold text-gray-900">
                {nodes.filter(n => n.status === 'OFFLINE').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Lỗi</p>
              <p className="text-2xl font-bold text-gray-900">
                {nodes.filter(n => n.status === 'ERROR').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng Proxies</p>
              <p className="text-2xl font-bold text-gray-900">
                {nodes.reduce((sum, n) => sum + (n.activeProxyCount || 0), 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm node..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-10"
            />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <Dropdown
            value={filterStatus}
            onChange={setFilterStatus}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              { value: 'ONLINE', label: 'Online' },
              { value: 'OFFLINE', label: 'Offline' },
              { value: 'ERROR', label: 'Lỗi' },
              { value: 'PENDING', label: 'Pending' }
            ]}
            className="min-w-[180px]"
          />
        </div>
      </div>

      {/* Nodes Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Node
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Địa chỉ IP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khu vực
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proxies
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Kiểm tra cuối
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredNodes.map((node) => (
                <tr key={node.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full ${getStatusDot(node.status)} mr-3`}></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{node.name}</div>
                        <div className="text-sm text-gray-500">{node.host}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {node.ipAddress}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {node.region?.name || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(node.status)}`}>
                      {node.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div>{node.activeProxyCount || 0} / {node.proxyCount || 0}</div>
                    <div className="text-xs text-gray-500">Active / Total</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {node.lastChecked ? new Date(node.lastChecked).toLocaleString('vi-VN') : 'Chưa kiểm tra'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {/* Primary Actions */}
                      <button 
                        onClick={() => handleTestConnection(node)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                        title="Test kết nối"
                      >
                        <Activity className="w-4 h-4" />
                      </button>
                      
                      {/* Secondary Actions Dropdown */}
                      <ActionDropdown 
                        options={getSecondaryActionOptions(node)}
                        className="ml-auto"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        
        {filteredNodes.length === 0 && (
          <div className="text-center py-6">
            <p className="text-gray-500">Không tìm thấy node nào</p>
          </div>
        )}
      </div>
    
    {/* Initialize 3Proxy Modal */}
    {selectedNode && (
      <Initialize3ProxyModal
        isOpen={initializeModalOpen}
        onClose={() => {
          setInitializeModalOpen(false);
          setSelectedNode(null);
        }}
        node={selectedNode}
        onSuccess={() => {
          fetchNodes();
          addToast({
            type: 'success',
            title: 'Cài đặt thành công',
            message: `3Proxy đã được cài đặt thành công trên node "${selectedNode.name}"`
          });
        }}
      />
    )}
  </div>
  );
};

export default NodesPage;
