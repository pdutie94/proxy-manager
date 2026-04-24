'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  Plus,
  Server,
  Shield,
  Globe,
  User,
  Lock,
  CheckCircle
} from 'lucide-react';
import Link from 'next/link';

export default function CreateProxyPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = parseInt(params.id as string);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    port: '',
    protocol: 'HTTP',
    username: '',
    password: '',
  });

  const protocols = [
    { value: 'HTTP', label: 'HTTP', icon: Globe },
    { value: 'SOCKS4', label: 'SOCKS4', icon: Shield },
    { value: 'SOCKS5', label: 'SOCKS5', icon: Shield },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const port = parseInt(formData.port);
      if (!port || port < 1 || port > 65535) {
        setError('Port không hợp lệ (1-65535)');
        return;
      }

      const data: any = {
        port,
        protocol: formData.protocol,
      };

      if (formData.username) {
        data.username = formData.username;
        data.password = formData.password;
      }

      await api.post(`/api/admin/servers/${serverId}/proxies`, data);
      router.push(`/admin/servers/${serverId}`);
    } catch (err: any) {
      setError(err.message || 'Không thể tạo proxy');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/admin/servers/${serverId}`}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại chi tiết máy chủ
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Tạo proxy mới</h1>
        <p className="mt-1 text-gray-600">
          Thêm proxy mới vào máy chủ #{serverId}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-none">
        {/* Port */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-2">
              <Server className="h-4 w-4 text-blue-500" />
              Cổng (Port) <span className="text-red-500">*</span>
            </span>
          </label>
          <input
            type="number"
            required
            min="1"
            max="65535"
            value={formData.port}
            onChange={(e) => setFormData(prev => ({ ...prev, port: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            placeholder="8080"
          />
          <p className="mt-1 text-xs text-gray-500">Port phải nằm trong range của máy chủ</p>
        </div>

        {/* Protocol */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            <span className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              Giao thức <span className="text-red-500">*</span>
            </span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {protocols.map((proto) => {
              const Icon = proto.icon;
              return (
                <button
                  key={proto.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, protocol: proto.value }))}
                  className={`flex items-center justify-center gap-1.5 lg:gap-2 px-2 lg:px-4 py-2 lg:py-3 rounded-lg border transition-all text-sm ${
                    formData.protocol === proto.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {proto.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Authentication (Optional) */}
        <div className="border-t border-gray-200 pt-6">
          <h3 className="text-sm font-medium text-gray-900 mb-4">Xác thực (Tùy chọn)</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  Username
                </span>
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({ ...prev, username: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="user123"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">
                <span className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-gray-400" />
                  Password
                </span>
              </label>
              <input
                type="text"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="pass123"
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Nếu không nhập, proxy sẽ không yêu cầu xác thực
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
          <Link
            href={`/admin/servers/${serverId}`}
            className="px-3 py-1.5 lg:px-4 lg:py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm"
          >
            Hủy
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
          >
            {loading ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                <span className="hidden sm:inline">Đang tạo...</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Tạo proxy</span>
                <span className="sm:hidden">Tạo</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
