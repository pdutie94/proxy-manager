'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
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
  Pencil,
  Shield,
  AlertTriangle,
  Play,
  ShieldCheck,
  FileText
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
  const hasFetched = useRef(false);

  const serverId = parseInt(params.id as string);

  useEffect(() => {
    if (serverId && !hasFetched.current) {
      hasFetched.current = true;
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

  // Connect to server - test SSH and install 3proxy if needed
  const connectServer = async () => {
    setActionLoading('connect');
    try {
      const response = await api.post<{ 
        success: boolean; 
        message: string; 
        status: string;
        step: string;
        error?: string;
      }>(`/api/admin/servers/${serverId}/connect`);

      if (response.success) {
        setServer(prev => prev ? { ...prev, status: response.status as any } : null);
        alert(response.message);
        // Refresh server data
        fetchServer();
      } else {
        alert(response.message || 'Kết nối thất bại');
        setServer(prev => prev ? { ...prev, status: response.status as any || 'ERROR' } : null);
      }
    } catch (error: any) {
      alert(error.message || 'Kết nối thất bại');
    } finally {
      setActionLoading('');
    }
  };

  // Check all proxies on this server
  const checkProxies = async () => {
    setActionLoading('checkProxies');
    try {
      const response = await api.post<{
        success: boolean;
        message: string;
        summary: {
          total: number;
          active: number;
          inactive: number;
        };
      }>(`/api/admin/servers/${serverId}/proxies/check`);

      if (response.success) {
        alert(response.message);
        // Refresh server data to get updated proxy statuses
        fetchServer();
      } else {
        alert(response.message || 'Kiểm tra thất bại');
      }
    } catch (error: any) {
      alert(error.message || 'Kiểm tra thất bại');
    } finally {
      setActionLoading('');
    }
  };

  // Sync proxies from 3proxy.cfg on server
  const syncProxies = async () => {
    setActionLoading('syncProxies');
    try {
      const response = await api.post<{
        success: boolean;
        warning?: boolean;
        message: string;
        summary?: {
          added: number;
          updated: number;
          unchanged: number;
          orphaned: number;
          details: {
            added: number[];
            updated: number[];
            unchanged: number[];
            orphaned: number[];
          };
        };
        error?: string;
      }>(`/api/admin/servers/${serverId}/sync-proxies`);

      if (response.warning) {
        alert(`⚠️ ${response.message}\n${response.error || ''}`);
      } else if (response.success && response.summary) {
        const { added, updated, unchanged, orphaned } = response.summary;
        alert(`✅ ${response.message}\n\nChi tiết:\n- Thêm mới: ${added} ports${added > 0 ? ` (${response.summary.details.added.join(', ')})` : ''}\n- Cập nhật: ${updated} ports${updated > 0 ? ` (${response.summary.details.updated.join(', ')})` : ''}\n- Không đổi: ${unchanged} ports\n- Không có trong config: ${orphaned} ports${orphaned > 0 ? ` (${response.summary.details.orphaned.join(', ')})` : ''}`);
        // Refresh server data to get updated proxy list
        fetchServer();
      } else {
        alert(response.message || 'Đồng bộ thất bại');
      }
    } catch (error: any) {
      alert(error.message || 'Đồng bộ thất bại');
    } finally {
      setActionLoading('');
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

  // Not connected states - show connection screen
  const isNotConnected = server.status === 'PENDING' || server.status === 'OFFLINE' || server.status === 'ERROR';

  if (isNotConnected) {
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
        </div>

        {/* Connection Required Card */}
        <div className="bg-white rounded-xl border border-gray-200 p-8 lg:p-12 text-center">
          <div className="mx-auto w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-6">
            <Shield className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-3">
            Chưa kết nối đến server
          </h2>
          <p className="text-gray-600 max-w-md mx-auto mb-8">
            Để quản lý proxy trên server này, bạn cần kết nối và cài đặt 3proxy. 
            Hệ thống sẽ tự động kiểm tra kết nối SSH và cài đặt 3proxy nếu chưa có.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={connectServer}
              disabled={actionLoading === 'connect'}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {actionLoading === 'connect' ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <Play className="h-5 w-5" />
              )}
              {actionLoading === 'connect' ? 'Đang kết nối...' : 'Kết nối server'}
            </button>
            <Link
              href="/admin/servers"
              className="inline-flex items-center gap-2 px-6 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              <ArrowLeft className="h-5 w-5" />
              Quay lại
            </Link>
          </div>

          {server.status === 'ERROR' && (
            <div className="mt-6 flex items-center justify-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm">Lần kết nối trước thất bại. Vui lòng kiểm tra lại thông tin SSH.</span>
            </div>
          )}
        </div>

        {/* Server Info Preview */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 lg:p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Thông tin server
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500">Host</p>
              <p className="text-sm font-medium text-gray-900">{server.host}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SSH Port</p>
              <p className="text-sm font-medium text-gray-900">{server.sshPort}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">SSH User</p>
              <p className="text-sm font-medium text-gray-900">{server.sshUsername}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Port Range</p>
              <p className="text-sm font-medium text-gray-900">{server.proxyPortStart} - {server.proxyPortEnd}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <button
            onClick={checkProxies}
            disabled={actionLoading !== '' || server.status !== 'ACTIVE'}
            className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 border border-gray-200 rounded-lg text-xs lg:text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {actionLoading === 'checkProxies' ? (
              <RefreshCw className="h-3.5 w-3.5 lg:h-4 lg:w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            )}
            <span className="hidden sm:inline">{actionLoading === 'checkProxies' ? 'Đang kiểm tra...' : 'Kiểm tra proxy'}</span>
            <span className="sm:hidden">{actionLoading === 'checkProxies' ? '...' : 'Proxy'}</span>
          </button>
          <button
            onClick={syncProxies}
            disabled={actionLoading !== '' || server.status !== 'ACTIVE'}
            className="inline-flex items-center gap-1.5 lg:gap-2 px-2 lg:px-3 py-1.5 lg:py-2 border border-amber-200 bg-amber-50 rounded-lg text-xs lg:text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            {actionLoading === 'syncProxies' ? (
              <RefreshCw className="h-3.5 w-3.5 lg:h-4 lg:w-4 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
            )}
            <span className="hidden sm:inline">{actionLoading === 'syncProxies' ? 'Đang đồng bộ...' : 'Đồng bộ proxy'}</span>
            <span className="sm:hidden">{actionLoading === 'syncProxies' ? '...' : 'Đồng bộ'}</span>
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
              <div className="divide-y divide-gray-200">
                {/* Header Row */}
                <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
                  <div className="col-span-1">Port</div>
                  <div className="col-span-2">Protocol</div>
                  <div className="col-span-2">Xác thực</div>
                  <div className="col-span-2">Trạng thái</div>
                  <div className="col-span-4">Gán cho</div>
                  <div className="col-span-1 text-right"></div>
                </div>

                {/* Proxy Rows */}
                {server.proxies.map((proxy) => (
                  <div
                    key={proxy.id}
                    className="group flex flex-col sm:grid sm:grid-cols-4 lg:grid-cols-12 gap-2 sm:gap-3 lg:gap-4 px-4 lg:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                  >
                    {/* Port */}
                    <div className="sm:col-span-1 lg:col-span-1 flex items-center">
                      <Link
                        href={`/admin/servers/${serverId}/proxies`}
                        className="text-lg font-bold text-gray-900 lg:text-base hover:text-blue-600 transition-colors"
                      >
                        {proxy.port}
                      </Link>
                    </div>

                    {/* Protocol */}
                    <div className="sm:col-span-1 lg:col-span-2 flex items-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        proxy.protocol === 'HTTP' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        proxy.protocol === 'SOCKS4' ? 'bg-green-100 text-green-800 border-green-200' :
                        'bg-purple-100 text-purple-800 border-purple-200'
                      }`}>
                        {proxy.protocol}
                      </span>
                    </div>

                    {/* Auth */}
                    <div className="sm:col-span-1 lg:col-span-2 flex items-center">
                      {proxy.username ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                          <LockIcon className="h-3 w-3" />
                          <span className="hidden sm:inline">Có</span>
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm">Không</span>
                      )}
                    </div>

                    {/* Status + Assigned */}
                    <div className="sm:col-span-1 lg:col-span-2 flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        proxy.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {proxy.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        {proxy.isActive ? 'Hoạt động' : 'Tắt'}
                      </span>
                      {/* Mobile assigned info */}
                      <span className="lg:hidden text-xs text-gray-500 truncate">
                        {proxy.customer ? proxy.customer.name : 'Chưa gán'}
                      </span>
                    </div>

                    {/* Assigned - Desktop */}
                    <div className="hidden lg:col-span-4 lg:flex flex-col justify-center">
                      {proxy.customer ? (
                        <>
                          <p className="text-sm font-medium text-gray-900 truncate">{proxy.customer.name}</p>
                          <p className="text-xs text-gray-500 truncate">{proxy.customer.email}</p>
                        </>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Chưa gán</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="sm:col-span-4 lg:col-span-1 flex items-center justify-between sm:justify-end gap-2 mt-1 sm:mt-0">
                      {/* Mobile info */}
                      <div className="lg:hidden flex items-center gap-2 text-sm text-gray-500">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">{proxy.protocol}</span>
                      </div>
                      <Link
                        href={`/admin/servers/${serverId}/proxies`}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Quản lý proxy"
                      >
                        <Eye className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
