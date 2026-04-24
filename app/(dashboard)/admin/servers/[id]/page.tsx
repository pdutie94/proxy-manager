'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Server,
  Activity,
  Trash2,
  Zap,
  Globe,
  User,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
  Plus,
  Eye,
  Lock as LockIcon,
  Pencil
} from 'lucide-react';
import Link from 'next/link';

interface Server {
  id: number;
  name: string;
  host: string;
  sshPort: number;
  sshUsername: string;
  proxyPortStart: number;
  proxyPortEnd: number;
  status: 'PENDING' | 'INSTALLING' | 'ACTIVE' | 'ERROR' | 'OFFLINE';
  createdAt: string;
  updatedAt: string;
  proxies: Array<{
    id: number;
    port: number;
    protocol: string;
    username?: string;
    isActive: boolean;
    assignedTo?: number;
    expiresAt?: string;
    customer?: {
      id: number;
      email: string;
      name: string;
    };
  }>;
  _count: {
    proxies: number;
  };
}

export default function ServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  
  const [server, setServer] = useState<Server | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const serverId = parseInt(params.id as string);

  useEffect(() => {
    if (serverId) {
      fetchServer();
    }
  }, [serverId]);

  const fetchServer = async () => {
    try {
      const response = await api.get<{ server: Server }>(`/api/admin/servers/${serverId}`);
      setServer(response.server);
    } catch (error) {
      console.error('Failed to fetch server:', error);
      setError('Failed to load server');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle, label: 'Hoạt động' };
      case 'PENDING':
        return { color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock, label: 'Chờ xử lý' };
      case 'INSTALLING':
        return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: RefreshCw, label: 'Đang cài đặt' };
      case 'ERROR':
        return { color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle, label: 'Lỗi' };
      case 'OFFLINE':
        return { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: XCircle, label: 'Offline' };
      default:
        return { color: 'bg-gray-100 text-gray-700 border-gray-200', icon: Activity, label: status };
    }
  };

  const testConnection = async () => {
    setActionLoading('test');
    try {
      const response = await api.post<{ success: boolean; message: string }>(`/api/admin/servers/${serverId}/test`);
      
      if (response.success) {
        setServer(prev => prev ? { ...prev, status: 'ACTIVE' } : null);
      }
      
      alert(response.message);
    } catch (error) {
      alert('Kiểm tra kết nối thất bại');
    } finally {
      setActionLoading('');
    }
  };

  const install3Proxy = async () => {
    if (!confirm('Bạn có chắc muốn cài đặt 3proxy? Quá trình này có thể mất vài phút.')) {
      return;
    }

    setActionLoading('install');
    try {
      setServer(prev => prev ? { ...prev, status: 'INSTALLING' } : null);

      const response = await api.post<{ success: boolean; message: string; status: string }>(`/api/admin/servers/${serverId}/install`);
      
      setServer(prev => prev ? { ...prev, status: response.status as any } : null);
      
      alert(response.message);
    } catch (error) {
      alert('Cài đặt thất bại');
      setServer(prev => prev ? { ...prev, status: 'ERROR' } : null);
    } finally {
      setActionLoading('');
    }
  };

  const deleteServer = async () => {
    if (!confirm('Bạn có chắc muốn xóa máy chủ này? Hành động này không thể hoàn tác.')) {
      return;
    }

    try {
      await api.delete(`/api/admin/servers/${serverId}`);
      router.push('/admin/servers');
    } catch (error) {
      alert('Không thể xóa máy chủ');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600">{error || 'Không tìm thấy máy chủ'}</div>
        <Link
          href="/admin/servers"
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại
        </Link>
      </div>
    );
  }

  const status = getStatusConfig(server.status);
  const StatusIcon = status.icon;

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-center gap-3 lg:gap-4">
          <Link
            href="/admin/servers"
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Server className="h-6 w-6 text-blue-600" />
              {server.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              <span className="text-sm text-gray-500">{server.host}:{server.sshPort}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={testConnection}
            disabled={actionLoading !== '' || server.status === 'INSTALLING'}
            className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 border border-gray-200 rounded-lg text-xs lg:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {actionLoading === 'test' ? (
              <RefreshCw className="h-3.5 w-3.5 lg:h-4 lg:w-4 animate-spin" />
            ) : (
              <Activity className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            )}
            <span className="hidden sm:inline">{actionLoading === 'test' ? 'Đang kiểm tra...' : 'Kiểm tra'}</span>
            <span className="sm:hidden">{actionLoading === 'test' ? '...' : 'Check'}</span>
          </button>
          {server.status !== 'INSTALLING' && (
            <button
              onClick={install3Proxy}
              disabled={actionLoading !== ''}
              className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-xs lg:text-sm font-medium disabled:opacity-50"
            >
              {actionLoading === 'install' ? (
                <RefreshCw className="h-3.5 w-3.5 lg:h-4 lg:w-4 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
              )}
              <span className="hidden sm:inline">{actionLoading === 'install' ? 'Đang cài...' : 'Cài 3proxy'}</span>
              <span className="sm:hidden">{actionLoading === 'install' ? '...' : 'Cài'}</span>
            </button>
          )}
          <Link
            href={`/admin/servers/${serverId}/edit`}
            className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-xs lg:text-sm font-medium"
            title="Sửa máy chủ"
          >
            <Pencil className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Sửa</span>
          </Link>
          <button
            onClick={deleteServer}
            disabled={server._count.proxies > 0}
            className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs lg:text-sm font-medium disabled:opacity-50"
            title={server._count.proxies > 0 ? 'Không thể xóa máy chủ đang có proxy' : 'Xóa máy chủ'}
          >
            <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            <span className="hidden sm:inline">Xóa</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Server Info */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-4 lg:p-6">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4 flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-500" />
              Thông tin máy chủ
            </h2>
            <dl className="space-y-4">
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  Host
                </dt>
                <dd className="text-sm font-medium text-gray-900">{server.host}:{server.sshPort}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500 flex items-center gap-1">
                  <User className="h-4 w-4" />
                  SSH User
                </dt>
                <dd className="text-sm font-medium text-gray-900">{server.sshUsername}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500">Port Range</dt>
                <dd className="text-sm font-medium text-gray-900">{server.proxyPortStart} - {server.proxyPortEnd}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500">Tổng proxy</dt>
                <dd className="text-sm font-medium text-gray-900">{server._count.proxies}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500">Ngày tạo</dt>
                <dd className="text-sm text-gray-900">{new Date(server.createdAt).toLocaleDateString('vi-VN')}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-sm text-gray-500">Cập nhật</dt>
                <dd className="text-sm text-gray-900">{new Date(server.updatedAt).toLocaleDateString('vi-VN')}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Proxies List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Danh sách proxy ({server.proxies.length})
              </h2>
              <Link
                href={`/admin/servers/${serverId}/proxies/create`}
                className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs lg:text-sm font-medium"
              >
                <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">Thêm proxy</span>
                <span className="sm:hidden">Thêm</span>
              </Link>
            </div>
            
            {server.proxies.length === 0 ? (
              <div className="p-6 lg:p-8 text-center">
                <Zap className="mx-auto h-10 w-10 lg:h-12 lg:w-12 text-gray-300" />
                <p className="mt-2 text-gray-500">Chưa có proxy nào trên máy chủ này</p>
                <Link
                  href={`/admin/servers/${serverId}/proxies/create`}
                  className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                  <span className="hidden sm:inline">Tạo proxy mới</span>
                  <span className="sm:hidden">Tạo proxy</span>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Port</th>
                      <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Protocol</th>
                      <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Xác thực</th>
                      <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Trạng thái</th>
                      <th className="px-3 lg:px-6 py-2 lg:py-3 text-left text-xs font-semibold text-gray-500 uppercase">Gán cho</th>
                      <th className="px-3 lg:px-6 py-2 lg:py-3 text-right text-xs font-semibold text-gray-500 uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {server.proxies.map((proxy) => (
                      <tr key={proxy.id} className="hover:bg-gray-50">
                        <td className="px-3 lg:px-6 py-2 lg:py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {proxy.port}
                        </td>
                        <td className="px-3 lg:px-6 py-2 lg:py-4 whitespace-nowrap text-sm text-gray-600">
                          {proxy.protocol}
                        </td>
                        <td className="px-3 lg:px-6 py-2 lg:py-4 whitespace-nowrap text-sm text-gray-600">
                          {proxy.username ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 lg:py-1 bg-blue-50 text-blue-700 rounded text-xs">
                              <LockIcon className="h-3 w-3" />
                              <span className="hidden sm:inline">Có</span>
                            </span>
                          ) : (
                            <span className="text-gray-400 hidden sm:inline">Không</span>
                          )}
                        </td>
                        <td className="px-3 lg:px-6 py-2 lg:py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full text-xs font-medium ${
                            proxy.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {proxy.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            <span className="hidden sm:inline">{proxy.isActive ? 'Hoạt động' : 'Tắt'}</span>
                          </span>
                        </td>
                        <td className="px-3 lg:px-6 py-2 lg:py-4 whitespace-nowrap text-sm text-gray-600">
                          {proxy.customer ? (
                            <div>
                              <p className="font-medium text-sm lg:text-base truncate">{proxy.customer.name}</p>
                              <p className="text-xs text-gray-400 hidden lg:block">{proxy.customer.email}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400">Chưa gán</span>
                          )}
                        </td>
                        <td className="px-3 lg:px-6 py-2 lg:py-4 whitespace-nowrap text-right">
                          <Link
                            href={`/admin/servers/${serverId}/proxies`}
                            className="p-1.5 lg:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Quản lý proxy"
                          >
                            <Eye className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
