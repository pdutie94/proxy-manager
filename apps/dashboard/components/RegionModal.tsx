'use client';

import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface RegionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (regionData: RegionFormData) => Promise<void>;
  editingRegion?: any;
  loading?: boolean;
}

interface RegionFormData {
  name: string;
  description?: string;
  isActive: boolean;
}

const RegionModal: React.FC<RegionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingRegion,
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
  const [formData, setFormData] = useState<RegionFormData>({
    name: '',
    description: '',
    isActive: true
  });

  const [errors, setErrors] = useState<Partial<Record<keyof RegionFormData, string>>>({});

  useEffect(() => {
    if (editingRegion) {
      setFormData({
        name: editingRegion.name || '',
        description: editingRegion.description || '',
        isActive: editingRegion.isActive ?? true
      });
    } else {
      setFormData({
        name: '',
        description: '',
        isActive: true
      });
    }
  }, [editingRegion]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof RegionFormData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'Tên khu vực là bắt buộc';

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
      console.error('Error submitting region:', error);
      throw error;
    }
  };

  const handleInputChange = (field: keyof RegionFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">
            {editingRegion ? 'Chỉnh sửa Khu vực' : 'Thêm Khu vực mới'}
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tên khu vực *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Singapore"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              rows={3}
              placeholder="Mô tả về khu vực..."
            />
          </div>

          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Kích hoạt</span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Khu vực đang hoạt động sẽ có thể được chọn khi tạo node mới
            </p>
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
                  <span>{editingRegion ? 'Cập nhật' : 'Tạo'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegionModal;
