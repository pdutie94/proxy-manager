'use client';

import React from 'react';
import { Settings, Shield, Bell, Database, Key, Save } from 'lucide-react';
import { useToast } from '@/components/Toast';

const SettingsPage: React.FC = () => {
  const { addToast } = useToast();

  const handleSave = () => {
    addToast({
      type: 'success',
      title: 'Đã lưu',
      message: 'Cấu hình hệ thống đã được cập nhật'
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt hệ thống</h1>
        <p className="text-gray-600">Quản lý cấu hình chung và bảo mật</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
        {/* Section: General */}
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Cấu hình chung</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tên hệ thống</label>
              <input type="text" defaultValue="Antigravity Proxy Manager" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Số Port mặc định (Max)</label>
              <input type="number" defaultValue="5000" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Section: Security */}
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Key className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Bảo mật & API</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">HMAC Secret Key</label>
              <div className="flex space-x-2">
                <input type="password" value="********************************" readOnly className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-gray-500" />
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Đổi Key</button>
              </div>
            </div>
            <div className="flex items-center">
              <input type="checkbox" id="verify-sig" defaultChecked className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500" />
              <label htmlFor="verify-sig" className="ml-2 text-sm text-gray-700">Bắt buộc xác thực chữ ký (Signature Verification)</label>
            </div>
          </div>
        </div>

        {/* Section: Notifications */}
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <Bell className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Thông báo</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Email cảnh báo</p>
                <p className="text-xs text-gray-500">Gửi email khi node bị lỗi hoặc offline</p>
              </div>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6"></span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Thông báo hết hạn</p>
                <p className="text-xs text-gray-500">Gửi thông báo trước 24h khi proxy hết hạn</p>
              </div>
              <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600">
                <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6"></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Save className="w-4 h-4 mr-2" />
          Lưu thay đổi
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
