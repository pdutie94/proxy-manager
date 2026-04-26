'use client';

import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import Link from 'next/link';
import { ShoppingCart, RefreshCw, Copy, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface Proxy {
  id: number;
  port: number;
  protocol: string;
  username?: string;
  password?: string;
  connectionString: string;
  expiresAt?: string;
  isActive: boolean;
  isExpired: boolean;
  createdAt: string;
  server: {
    id: number;
    name: string;
    host: string;
  };
}

const RENEW_PRESETS = [
  { label: '1 ngày', days: 1 },
  { label: '3 ngày', days: 3 },
  { label: '1 tuần', days: 7 },
  { label: '1 tháng', days: 30 },
];

export default function CustomerProxies() {
  const { user } = useAuthStore();
  const { success, error: toastError } = useToast();
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [renewLoading, setRenewLoading] = useState<number | null>(null);
  const hasFetched = useRef(false);

  // Confirm modal for renew
  const [renewModal, setRenewModal] = useState<{
    isOpen: boolean;
    proxy: Proxy | null;
    days: number;
  }>({
    isOpen: false,
    proxy: null,
    days: 0,
  });

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    fetchProxies();
  }, []);

  const fetchProxies = async () => {
    try {
      const response = await api.get<{ proxies: any[]; total: number }>('/api/customer/proxies');
      setProxies(response.proxies);
    } catch (error) {
      console.error('Failed to fetch proxies:', error);
      setError('Failed to load proxies');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    success('Đã sao chép connection string');
  };

  const openRenewModal = (proxy: Proxy, days: number) => {
    setRenewModal({
      isOpen: true,
      proxy,
      days,
    });
  };

  const confirmRenew = async () => {
    if (!renewModal.proxy) return;

    setRenewModal(prev => ({ ...prev, isOpen: false }));
    setRenewLoading(renewModal.proxy.id);

    try {
      const response = await api.post<{
        message: string;
        credentials: { username: string; password: string; isNew: boolean };
        gracePeriodInfo: { daysSinceExpiry: number; withinGracePeriod: boolean };
      }>(`/api/customer/proxies/${renewModal.proxy.id}/renew`, {
        additionalDays: renewModal.days,
      });

      const msg = response.credentials.isNew 
        ? `Đã gia hạn proxy port ${renewModal.proxy.port}. Thông tin đăng nhập mới đã được cấp.`
        : `Đã gia hạn proxy port ${renewModal.proxy.port}. Thông tin đăng nhập giữ nguyên.`;
      
      success(msg);
      fetchProxies(); // Refresh list
    } catch (error) {
      console.error('Renew proxy failed:', error);
      toastError('Không thể gia hạn proxy');
    } finally {
      setRenewLoading(null);
    }
  };

  const getConnectionString = (proxy: Proxy) => {
    return proxy.connectionString;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const formatPrice = (days: number) => {
    // Simple pricing: 10k per day
    const price = days * 10000;
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

  const getDaysSinceExpiry = (expiresAt: string) => {
    const expiryDate = new Date(expiresAt);
    const now = new Date();
    return Math.floor((now.getTime() - expiryDate.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getGracePeriodStatus = (expiresAt: string) => {
    const daysSinceExpiry = getDaysSinceExpiry(expiresAt);
    const remainingDays = 3 - daysSinceExpiry;
    if (remainingDays > 0) {
      return { withinGrace: true, remainingDays, message: `Còn ${remainingDays} ngày giữ thông tin cũ` };
    }
    return { withinGrace: false, remainingDays: 0, message: 'Sẽ cấp thông tin đăng nhập mới khi gia hạn' };
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Proxies</h1>
          <p className="mt-2 text-gray-600">
            Quản lý và theo dõi proxy của bạn
          </p>
        </div>
        <Link
          href="/customer/rent"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ShoppingCart className="h-4 w-4" />
          Thuê proxy mới
        </Link>
      </div>

      {proxies.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <div className="mx-auto h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <XCircle className="h-6 w-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Chưa có proxy</h3>
          <p className="mt-1 text-gray-500">
            Bạn chưa có proxy nào. Hãy thuê proxy để bắt đầu.
          </p>
          <Link
            href="/customer/rent"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <ShoppingCart className="h-4 w-4" />
            Thuê proxy ngay
          </Link>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {proxies.map((proxy) => (
              <li key={proxy.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <p className="text-sm font-medium text-gray-900">
                          {proxy.server.name} - {proxy.protocol} :{proxy.port}
                        </p>
                        {proxy.isExpired ? (
                          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            Đã hết hạn
                          </span>
                        ) : proxy.isActive ? (
                          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Đang hoạt động
                          </span>
                        ) : (
                          <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                            Không hoạt động
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-500">
                        Server: {proxy.server.host}
                      </p>
                      {proxy.expiresAt && (
                        <p className={`mt-1 text-sm ${proxy.isExpired ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                          {proxy.isExpired ? 'Đã hết hạn: ' : 'Hết hạn: '}
                          {new Date(proxy.expiresAt).toLocaleDateString('vi-VN')}
                        </p>
                      )}
                      {!proxy.isExpired && (
                        <div className="mt-2">
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {getConnectionString(proxy)}
                          </code>
                        </div>
                      )}
                    </div>
                    <div className="ml-4 flex-shrink-0 flex flex-col gap-2">
                      {!proxy.isExpired && (
                        <button
                          onClick={() => copyToClipboard(getConnectionString(proxy))}
                          className="inline-flex items-center gap-1 px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </button>
                      )}
                      {proxy.isExpired && (
                        <div className="flex flex-col gap-2">
                          {proxy.expiresAt && (
                            <span className={`text-xs ${getGracePeriodStatus(proxy.expiresAt).withinGrace ? 'text-amber-600' : 'text-gray-500'}`}>
                              {getGracePeriodStatus(proxy.expiresAt).message}
                            </span>
                          )}
                          <span className="text-xs text-gray-500">Gia hạn:</span>
                          <div className="flex gap-1">
                            {RENEW_PRESETS.slice(0, 2).map((preset) => (
                              <button
                                key={preset.days}
                                onClick={() => openRenewModal(proxy, preset.days)}
                                disabled={renewLoading === proxy.id}
                                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>
                          <select
                            value=""
                            onChange={(e) => {
                              const days = parseInt(e.target.value);
                              if (days) openRenewModal(proxy, days);
                            }}
                            disabled={renewLoading === proxy.id}
                            className="text-xs border border-gray-300 rounded px-2 py-1"
                          >
                            <option value="">Chọn thời hạn...</option>
                            {RENEW_PRESETS.map((preset) => (
                              <option key={preset.days} value={preset.days}>
                                {preset.label} - {formatPrice(preset.days)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Cách sử dụng proxy</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ol className="list-decimal list-inside space-y-1">
                <li>Sao chép connection string bằng nút Copy</li>
                <li>Cấu hình trình duyệt hoặc ứng dụng của bạn để sử dụng proxy</li>
                <li>Nhập connection string vào cài đặt proxy</li>
                <li>Nếu yêu cầu xác thực, sử dụng username và password được cung cấp</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* Renew Modal */}
      <ConfirmModal
        isOpen={renewModal.isOpen}
        onConfirm={confirmRenew}
        onCancel={() => setRenewModal(prev => ({ ...prev, isOpen: false }))}
        title="Gia hạn proxy"
        message={renewModal.proxy ? 
          `Bạn có chắc muốn gia hạn proxy port ${renewModal.proxy.port} thêm ${RENEW_PRESETS.find(p => p.days === renewModal.days)?.label}?` :
          ''
        }
        variant="primary"
        confirmText={`Thanh toán ${formatPrice(renewModal.days)}`}
        cancelText="Hủy"
        loading={renewLoading === renewModal.proxy?.id}
      />
    </div>
  );
}
