'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Edit, Trash2, Eye, Globe, CheckCircle, XCircle } from 'lucide-react';
import { api } from '@/lib/api';
import Dropdown from '@/components/Dropdown';
import { useModal } from '@/components/ModalContainer';
import { useToast } from '@/components/Toast';

interface Region {
  id: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: {
    nodes: number;
  };
}

const RegionsPage: React.FC = () => {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [modalLoading, setModalLoading] = useState(false);
  const { addToast } = useToast();
  const { openRegionModal, openConfirmModal } = useModal();

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      const regionsData = await api.getRegions();
      setRegions(regionsData);
    } catch (error) {
      console.error('Error fetching regions:', error);
      setRegions([]);
    } finally {
      setLoading(false);
    }
  };

  // CRUD Operations
  const handleCreateRegion = async (regionData: any) => {
    setModalLoading(true);
    try {
      await api.createRegion(regionData);
      await fetchRegions();
      addToast({
        type: 'success',
        title: 'Thêm khu vực thành công',
        message: `Khu vực "${regionData.name}" đã được tạo thành công`
      });
    } catch (error) {
      console.error('Error creating region:', error);
      addToast({
        type: 'error',
        title: 'Thêm khu vực thất bại',
        message: 'Không thể tạo khu vực. Vui lòng thử lại.'
      });
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleEditRegion = async (regionData: any, region: Region) => {
    setModalLoading(true);
    try {
      await api.updateRegion(region.id, regionData);
      await fetchRegions();
      addToast({
        type: 'success',
        title: 'Cập nhật khu vực thành công',
        message: `Khu vực "${regionData.name}" đã được cập nhật thành công`
      });
    } catch (error) {
      console.error('Error updating region:', error);
      addToast({
        type: 'error',
        title: 'Cập nhật khu vực thất bại',
        message: 'Không thể cập nhật khu vực. Vui lòng thử lại.'
      });
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleDeleteRegion = async (region: Region) => {
    setModalLoading(true);
    try {
      await api.deleteRegion(region.id);
      await fetchRegions();
      addToast({
        type: 'success',
        title: 'Xóa khu vực thành công',
        message: `Khu vực "${region.name}" đã được xóa thành công`
      });
    } catch (error) {
      console.error('Error deleting region:', error);
      addToast({
        type: 'error',
        title: 'Xóa khu vực thất bại',
        message: 'Không thể xóa khu vực. Vui lòng thử lại.'
      });
      throw error;
    } finally {
      setModalLoading(false);
    }
  };

  const handleToggleStatus = async (region: Region) => {
    try {
      await api.updateRegion(region.id, { isActive: !region.isActive });
      await fetchRegions();
      addToast({
        type: 'success',
        title: 'Cập nhật trạng thái thành công',
        message: `Khu vực "${region.name}" đã được ${!region.isActive ? 'kích hoạt' : 'vô hiệu hóa'} thành công`
      });
    } catch (error) {
      console.error('Error toggling region status:', error);
      addToast({
        type: 'error',
        title: 'Cập nhật trạng thái thất bại',
        message: 'Không thể cập nhật trạng thái khu vực. Vui lòng thử lại.'
      });
    }
  };

  // Modal handlers
  const openCreateModal = () => {
    openRegionModal(undefined, handleCreateRegion);
  };

  const openEditModal = (region: Region) => {
    openRegionModal(region, (data) => handleEditRegion(data, region));
  };

  const openDeleteModal = (region: Region) => {
    openConfirmModal({
      title: 'Xóa Khu vực',
      message: `Bạn có chắc chắn muốn xóa khu vực "${region.name}"? Hành động này không thể hoàn tác.`,
      onConfirm: () => handleDeleteRegion(region),
      loading: modalLoading,
    });
  };

  
  const getStatusColor = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-100 text-green-800' 
      : 'bg-gray-100 text-gray-800';
  };

  const getStatusDot = (isActive: boolean) => {
    return isActive 
      ? 'bg-green-500' 
      : 'bg-gray-400';
  };

  const filteredRegions = regions.filter(region => {
    const matchesSearch = region.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (region.description?.toLowerCase().includes(searchTerm.toLowerCase()) || false);
    const matchesFilter = filterStatus === 'all' || 
                         (filterStatus === 'active' && region.isActive) ||
                         (filterStatus === 'inactive' && !region.isActive);
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
          <h1 className="text-2xl font-bold text-gray-900">Quản lý Khu vực</h1>
          <p className="text-gray-600">Quản lý các khu vực địa lý trong hệ thống</p>
        </div>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4 mr-2" />
          Thêm Khu vực
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start">
            <div className="p-2 bg-green-100 rounded-lg">
              <Globe className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Tổng khu vực</p>
              <p className="text-2xl font-bold text-gray-900">
                {regions.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Đang hoạt động</p>
              <p className="text-2xl font-bold text-gray-900">
                {regions.filter(r => r.isActive).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-start">
            <div className="p-2 bg-gray-100 rounded-lg">
              <XCircle className="w-6 h-6 text-gray-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-600">Không hoạt động</p>
              <p className="text-2xl font-bold text-gray-900">
                {regions.filter(r => !r.isActive).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-lg border border-gray-200">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Tìm kiếm khu vực..."
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
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'inactive', label: 'Không hoạt động' }
            ]}
            className="flex-1 sm:min-w-[180px] sm:flex-none"
          />
        </div>
      </div>

      {/* Regions Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Khu vực
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Mô tả
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Nodes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredRegions.map((region) => (
                <tr key={region.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full ${getStatusDot(region.isActive)} mr-3`}></div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{region.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {region.description || (
                        <span className="text-gray-400 italic">Chưa có mô tả</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(region.isActive)}`}>
                      {region.isActive ? 'Đang hoạt động' : 'Không hoạt động'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <span>{region._count.nodes}</span>
                      <span className="text-xs text-gray-500">nodes</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {new Date(region.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button 
                        onClick={() => handleToggleStatus(region)}
                        className={`${
                          region.isActive ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'
                        }`}
                        title={region.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      >
                        {region.isActive ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={() => openEditModal(region)}
                        className="text-gray-600 hover:text-gray-900"
                        title="Chỉnh sửa"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => openDeleteModal(region)}
                        className="text-red-600 hover:text-red-900"
                        title="Xóa"
                        disabled={region._count.nodes > 0}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredRegions.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Không tìm thấy khu vực nào</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegionsPage;
