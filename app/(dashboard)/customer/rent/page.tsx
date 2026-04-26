'use client';

import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { Server, Clock, Globe, CheckCircle, XCircle, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

interface AvailableProxy {
  id: number;
  port: number;
  protocol: 'HTTP' | 'SOCKS4' | 'SOCKS5';
  server: {
    id: number;
    name: string;
    host: string;
  };
}

const DURATION_PRESETS = [
  { label: '1 ngày', days: 1, price: 10000 },
  { label: '3 ngày', days: 3, price: 25000 },
  { label: '1 tuần', days: 7, price: 50000 },
  { label: '1 tháng', days: 30, price: 150000 },
  { label: '3 tháng', days: 90, price: 400000 },
];

export default function RentProxyPage() {
  const { user } = useAuthStore();
  const { success, error: toastError } = useToast();
  const [proxies, setProxies] = useState<AvailableProxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentLoading, setRentLoading] = useState<number | null>(null);
  const [selectedDurations, setSelectedDurations] = useState<Record<number, number>>({});
  const hasFetched = useRef(false);

  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    proxy: AvailableProxy | null;
    days: number;
    price: number;
  }>({
    isOpen: false,
    proxy: null,
    days: 0,
    price: 0,
  });

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchAvailableProxies();
  }, []);

  const fetchAvailableProxies = async () => {
    try {
      const response = await api.get<{ proxies: AvailableProxy[] }>('/api/customer/available-proxies');
      setProxies(response.proxies);
    } catch (error) {
      console.error('Failed to fetch available proxies:', error);
      toastError('Không thể tải danh sách proxy');
    } finally {
      setLoading(false);
    }
  };

  const handleDurationChange = (proxyId: number, days: number) => {
    setSelectedDurations(prev => ({ ...prev, [proxyId]: days }));
  };

  const rentProxy = async (proxy: AvailableProxy, days: number, price: number) => {
    setConfirmModal({
      isOpen: true,
      proxy,
      days,
      price,
    });
  };

  const confirmRent = async () => {
    if (!confirmModal.proxy) return;

    setConfirmModal(prev => ({ ...prev, isOpen: false }));
    setRentLoading(confirmModal.proxy.id);

    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + confirmModal.days);

      await api.post('/api/customer/rent-proxy', {
        proxyId: confirmModal.proxy.id,
        expiresAt: expiresAt.toISOString(),
      });

      success(`Đã thuê proxy port ${confirmModal.proxy.port} thành công`);
      // Remove rented proxy from list
      setProxies(prev => prev.filter(p => p.id !== confirmModal.proxy!.id));
    } catch (error) {
      console.error('Rent proxy failed:', error);
      toastError('Không thể thuê proxy');
    } finally {
      setRentLoading(null);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price);
  };

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
          <h1 className="text-2xl font-bold text-gray-900">Thuê Proxy</h1>
          <p className="text-sm text-gray-500 mt-1">Chọn proxy và thời hạn phù hợp</p>
        </div>
        <Link
          href="/customer/proxies"
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
        >
          <CheckCircle className="h-4 w-4" />
          Proxy của tôi
        </Link>
      </div>

      {/* Proxies Grid */}
      {proxies.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <Server className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Không có proxy khả dụng</h3>
          <p className="text-gray-500 mt-1">Vui lòng quay lại sau</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proxies.map((proxy) => (
            <div key={proxy.id} className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Globe className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Port {proxy.port}</h3>
                    <p className="text-sm text-gray-500">{proxy.server.name}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  proxy.protocol === 'HTTP' ? 'bg-blue-100 text-blue-800' :
                  proxy.protocol === 'SOCKS4' ? 'bg-green-100 text-green-800' :
                  'bg-purple-100 text-purple-800'
                }`}>
                  {proxy.protocol}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Server className="h-4 w-4" />
                  {proxy.server.host}
                </p>
              </div>

              {/* Duration Selection */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Chọn thời hạn
                </label>
                <select
                  value={selectedDurations[proxy.id] || ''}
                  onChange={(e) => handleDurationChange(proxy.id, parseInt(e.target.value))}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">-- Chọn --</option>
                  {DURATION_PRESETS.map((preset) => (
                    <option key={preset.days} value={preset.days}>
                      {preset.label} - {formatPrice(preset.price)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rent Button */}
              <button
                onClick={() => {
                  const days = selectedDurations[proxy.id];
                  if (!days) {
                    toastError('Vui lòng chọn thời hạn');
                    return;
                  }
                  const preset = DURATION_PRESETS.find(p => p.days === days);
                  if (preset) {
                    rentProxy(proxy, days, preset.price);
                  }
                }}
                disabled={rentLoading === proxy.id || !selectedDurations[proxy.id]}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rentLoading === proxy.id ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4" />
                    Thuê ngay
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onConfirm={confirmRent}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title="Xác nhận thuê proxy"
        message={confirmModal.proxy ? 
          `Bạn có chắc muốn thuê proxy port ${confirmModal.proxy.port} (${confirmModal.proxy.protocol}) trên ${confirmModal.proxy.server.name} với thời hạn ${DURATION_PRESETS.find(p => p.days === confirmModal.days)?.label}?` :
          ''
        }
        variant="primary"
        confirmText={`Thanh toán ${formatPrice(confirmModal.price)}`}
        cancelText="Hủy"
        loading={rentLoading === confirmModal.proxy?.id}
      />
    </div>
  );
}
