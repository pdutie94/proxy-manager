'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ArrowLeft,
  Server,
  Globe,
  Lock,
  Key,
  Plus,
  Settings,
  Shield,
  Save,
  RefreshCw
} from 'lucide-react';
import Link from 'next/link';

export default function CreateServerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    host: '',
    sshPort: 22,
    sshUsername: '',
    sshPassword: '',
    sshPrivateKey: '',
    sshKeyPassphrase: '',
    proxyPortStart: 10000,
    proxyPortEnd: 20000,
  });

  const [usePrivateKey, setUsePrivateKey] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate form
      if (!formData.name || !formData.host || !formData.sshUsername) {
        setError('Vui lòng nhập tên máy chủ, địa chỉ host và tên đăng nhập SSH');
        setLoading(false);
        return;
      }

      if (!usePrivateKey && !formData.sshPassword) {
        setError('Vui lòng nhập mật khẩu SSH hoặc chọn xác thực bằng private key');
        setLoading(false);
        return;
      }

      // Prepare server data
      const serverData = {
        ...formData,
        sshPassword: usePrivateKey ? null : formData.sshPassword,
        sshPrivateKey: usePrivateKey ? formData.sshPrivateKey : null,
        sshKeyPassphrase: usePrivateKey ? formData.sshKeyPassphrase || null : null,
      };

      await api.post<{ server: any }>('/api/admin/servers', serverData);
      router.push('/admin/servers');
    } catch (err: any) {
      setError(err.message || 'Không thể tạo máy chủ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-none">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/admin/servers"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách máy chủ
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Plus className="h-6 w-6 text-blue-600" />
          Thêm máy chủ mới
        </h1>
        <p className="mt-1 text-gray-600">
          Kết nối máy chủ mới vào hệ thống quản lý proxy
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-4 lg:p-6 space-y-6 lg:space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Server Info Section */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="h-5 w-5 text-blue-500" />
            Thông tin máy chủ
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Tên máy chủ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="Máy chủ Hà Nội"
              />
            </div>

            <div>
              <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
                <span className="flex items-center gap-1">
                  <Globe className="h-4 w-4 text-gray-400" />
                  IP/Domain <span className="text-red-500">*</span>
                </span>
              </label>
              <input
                type="text"
                id="host"
                name="host"
                value={formData.host}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="192.168.1.100 hoặc proxy.example.com"
              />
            </div>

            <div>
              <label htmlFor="sshPort" className="block text-sm font-medium text-gray-700 mb-1">
                Cổng SSH
              </label>
              <input
                type="number"
                id="sshPort"
                name="sshPort"
                value={formData.sshPort}
                onChange={handleInputChange}
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="22"
              />
            </div>

            <div>
              <label htmlFor="sshUsername" className="block text-sm font-medium text-gray-700 mb-1">
                Tên đăng nhập SSH <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="sshUsername"
                name="sshUsername"
                value={formData.sshUsername}
                onChange={handleInputChange}
                required
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="root"
              />
            </div>
          </div>
        </div>

        {/* Proxy Range Section */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Settings className="h-5 w-5 text-blue-500" />
            Cấu hình proxy
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="proxyPortStart" className="block text-sm font-medium text-gray-700 mb-1">
                Port bắt đầu
              </label>
              <input
                type="number"
                id="proxyPortStart"
                name="proxyPortStart"
                value={formData.proxyPortStart}
                onChange={handleInputChange}
                min="1"
                max="65535"
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="10000"
              />
            </div>

            <div>
              <label htmlFor="proxyPortEnd" className="block text-sm font-medium text-gray-700 mb-1">
                Port kết thúc
              </label>
              <input
                type="number"
                id="proxyPortEnd"
                name="proxyPortEnd"
                value={formData.proxyPortEnd}
                onChange={handleInputChange}
                min="1"
                max="65535"
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="20000"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Các proxy sẽ được tạo trong khoảng port này
          </p>
        </div>

        {/* SSH Authentication Section */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            Xác thực SSH
          </h2>
          
          <div className="flex gap-4 mb-4">
            <button
              type="button"
              onClick={() => setUsePrivateKey(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                !usePrivateKey
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Lock className="h-4 w-4" />
              Mật khẩu
            </button>
            <button
              type="button"
              onClick={() => setUsePrivateKey(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                usePrivateKey
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Key className="h-4 w-4" />
              Private Key
            </button>
          </div>

          {usePrivateKey ? (
            <div>
              <label htmlFor="sshPrivateKey" className="block text-sm font-medium text-gray-700 mb-1">
                SSH Private Key <span className="text-red-500">*</span>
              </label>
              <textarea
                id="sshPrivateKey"
                name="sshPrivateKey"
                value={formData.sshPrivateKey}
                onChange={handleInputChange}
                required={usePrivateKey}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              />
              <p className="mt-1 text-xs text-gray-500">
                Hỗ trợ: OpenSSH format (Ed25519, RSA, ECDSA), PEM format. Tự động sửa lỗi paste.
              </p>
              <p className="mt-1 text-xs text-amber-600">
                Lưu ý: Nếu dùng PuTTY (.ppk), vui lòng dùng PuTTYgen để Export -&gt; OpenSSH key.
              </p>

              {/* Passphrase for encrypted key */}
              <div className="mt-4">
                <label htmlFor="sshKeyPassphrase" className="block text-sm font-medium text-gray-700 mb-1">
                  Passphrase (nếu key được mã hóa)
                </label>
                <input
                  type="password"
                  id="sshKeyPassphrase"
                  name="sshKeyPassphrase"
                  value={formData.sshKeyPassphrase}
                  onChange={handleInputChange}
                  className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  placeholder="Mật khẩu bảo vệ private key (nếu có)"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Chỉ nhập nếu private key được tạo với passphrase
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label htmlFor="sshPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Mật khẩu SSH <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                id="sshPassword"
                name="sshPassword"
                value={formData.sshPassword}
                onChange={handleInputChange}
                required={!usePrivateKey}
                className="w-full border border-gray-200 rounded-lg px-3 lg:px-4 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                placeholder="••••••••"
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-200">
          <Link
            href="/admin/servers"
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
                <RefreshCw className="h-3.5 w-3.5 lg:h-4 lg:w-4 animate-spin" />
                <span className="hidden sm:inline">Đang lưu...</span>
                <span className="sm:hidden">...</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Thêm máy chủ</span>
                <span className="sm:hidden">Thêm</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
