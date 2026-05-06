'use client';

import React, { useState, useEffect } from 'react';
import { X, Save, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';
import Dropdown from '@/components/Dropdown';

interface NodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (nodeData: NodeFormData) => Promise<void>;
  editingNode?: any;
  loading?: boolean;
}

interface NodeFormData {
  name: string;
  host: string;
  ipAddress: string;
  regionId: number | null;
  sshPort: number;
  sshUsername: string;
  sshPassword: string;
  sshPrivateKey: string;
  sshKeyPassphrase: string;
  maxPorts: number;
  ipv6Subnet: string;
  proxyPortStart: number;
  proxyPortEnd: number;
}

interface Region {
  id: number;
  name: string;
}

const NodeModal: React.FC<NodeModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingNode,
  loading = false
}) => {
  // Disable body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);
  const [formData, setFormData] = useState<NodeFormData>({
    name: '',
    host: '',
    ipAddress: '',
    regionId: null,
    sshPort: 22,
    sshUsername: '',
    sshPassword: '',
    sshPrivateKey: '',
    sshKeyPassphrase: '',
    maxPorts: 1000,
    ipv6Subnet: '',
    proxyPortStart: 8000,
    proxyPortEnd: 9000
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof NodeFormData, string>>>({});
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);

  useEffect(() => {
    if (editingNode) {
      setFormData({
        name: editingNode.name || '',
        host: editingNode.host || '',
        ipAddress: editingNode.ipAddress || '',
        regionId: editingNode.regionId ? String(editingNode.regionId) : null,
        sshPort: editingNode.sshPort || 22,
        sshUsername: editingNode.sshUsername || '',
        sshPassword: editingNode.sshPassword || '',
        sshPrivateKey: editingNode.sshPrivateKey || '',
        sshKeyPassphrase: editingNode.sshKeyPassphrase || '',
        maxPorts: editingNode.maxPorts || 1000,
        ipv6Subnet: editingNode.ipv6Subnet || '',
        proxyPortStart: editingNode.proxyPortStart || 8000,
        proxyPortEnd: editingNode.proxyPortEnd || 9000
      });
    }
  }, [editingNode]);

  useEffect(() => {
    const fetchRegions = async () => {
      try {
        const regionsData = await api.getRegions();
        setRegions(regionsData);
      } catch (error) {
        console.error('Error fetching regions:', error);
      } finally {
        setRegionsLoading(false);
      }
    };

    if (isOpen) {
      fetchRegions();
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof NodeFormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Tên node là bắt buộc';
    if (!formData.ipAddress.trim()) newErrors.ipAddress = 'Địa chỉ IP là bắt buộc';
    if (!formData.regionId) newErrors.regionId = 'Khu vực là bắt buộc';
    if (!formData.sshUsername.trim()) newErrors.sshUsername = 'SSH username là bắt buộc';
    if (!formData.sshPassword && !formData.sshPrivateKey) {
      newErrors.sshPassword = 'Cần có SSH password hoặc private key';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      console.error('Error submitting node:', error);
    }
  };

  const handleInputChange = (field: keyof NodeFormData, value: string | number | null) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingNode ? 'Chỉnh sửa Node' : 'Thêm Node mới'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-auto">
          <form onSubmit={handleSubmit} className="px-4 py-3 space-y-4">
          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Thông tin cơ bản</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên node *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="node-sg-01"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Địa chỉ IP *
                </label>
                <input
                  type="text"
                  value={formData.ipAddress}
                  onChange={(e) => handleInputChange('ipAddress', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.ipAddress ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="192.168.1.100"
                />
                {errors.ipAddress && (
                  <p className="mt-1 text-sm text-red-600">{errors.ipAddress}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Host (Optional)
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => handleInputChange('host', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="sg1.proxyserver.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Khu vực *
                </label>
                <Dropdown
                  options={[
                    { value: '', label: 'Chọn khu vực...' },
                    ...regions.map(region => ({
                      value: region.id.toString(),
                      label: region.name
                    }))
                  ]}
                  value={formData.regionId?.toString() || ''}
                  onChange={(value) => handleInputChange('regionId', value ? parseInt(value) : null)}
                  className={`w-full ${
                    errors.regionId ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={regionsLoading}
                />
                {errors.regionId && (
                  <p className="mt-1 text-sm text-red-600">{errors.regionId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IPv6 Subnet (Optional)
                </label>
                <input
                  type="text"
                  value={formData.ipv6Subnet}
                  onChange={(e) => handleInputChange('ipv6Subnet', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="2406:da18:778:1::/64"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Ports
                </label>
                <input
                  type="number"
                  value={formData.maxPorts}
                  onChange={(e) => handleInputChange('maxPorts', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="65535"
                />
              </div>
            </div>
          </div>

          {/* SSH Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Cấu hình SSH</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSH Port
                </label>
                <input
                  type="number"
                  value={formData.sshPort}
                  onChange={(e) => handleInputChange('sshPort', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="65535"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSH Username *
                </label>
                <input
                  type="text"
                  value={formData.sshUsername}
                  onChange={(e) => handleInputChange('sshUsername', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.sshUsername ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="root"
                />
                {errors.sshUsername && (
                  <p className="mt-1 text-sm text-red-600">{errors.sshUsername}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSH Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.sshPassword}
                    onChange={(e) => handleInputChange('sshPassword', e.target.value)}
                    className={`w-full px-3 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors.sshPassword ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Nhập password hoặc sử dụng private key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.sshPassword && (
                  <p className="mt-1 text-sm text-red-600">{errors.sshPassword}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SSH Private Key
                </label>
                <div className="relative">
                  <textarea
                    value={formData.sshPrivateKey}
                    onChange={(e) => handleInputChange('sshPrivateKey', e.target.value)}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    rows={3}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrivateKey(!showPrivateKey)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                  >
                    {showPrivateKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Port Configuration */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Cấu hình Port</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proxy Port Start
                </label>
                <input
                  type="number"
                  value={formData.proxyPortStart}
                  onChange={(e) => handleInputChange('proxyPortStart', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="65535"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proxy Port End
                </label>
                <input
                  type="number"
                  value={formData.proxyPortEnd}
                  onChange={(e) => handleInputChange('proxyPortEnd', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="1"
                  max="65535"
                />
              </div>
            </div>
          </div>

          </form>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 flex-shrink-0">
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors text-sm"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 text-sm"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{editingNode ? 'Cập nhật' : 'Tạo'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NodeModal;
