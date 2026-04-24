'use client';

import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import {
  Server,
  Plus,
  Search,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Settings,
  Zap,
  ArrowRight,
  RefreshCw,
  ExternalLink,
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
  _count: {
    proxies: number;
  };
}

export default function ServersPage() {
  const { user } = useAuthStore();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await api.get<{ servers: Server[] }>('/api/admin/servers');
      setServers(response.servers);
    } catch (error) {
      setError('Không thể tải danh sách máy chủ');
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return {
          color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
          icon: CheckCircle,
          label: 'Hoạt động'
        };
      case 'PENDING':
        return {
          color: 'bg-amber-100 text-amber-700 border-amber-200',
          icon: Clock,
          label: 'Chờ xử lý'
        };
      case 'INSTALLING':
        return {
          color: 'bg-blue-100 text-blue-700 border-blue-200',
          icon: RefreshCw,
          label: 'Đang cài đặt'
        };
      case 'ERROR':
        return {
          color: 'bg-red-100 text-red-700 border-red-200',
          icon: XCircle,
          label: 'Lỗi'
        };
      case 'OFFLINE':
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: XCircle,
          label: 'Offline'
        };
      default:
        return {
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          icon: Activity,
          label: status
        };
    }
  };

  const testConnection = async (serverId: number) => {
    setActionLoading(serverId);
    try {
      const response = await api.post<{ success: boolean; message: string }>(`/api/admin/servers/${serverId}/test`);

      if (response.success) {
        setServers(prev => prev.map(server =>
          server.id === serverId
            ? { ...server, status: 'ACTIVE' }
            : server
        ));
      }

      alert(response.message);
    } catch (error) {
      alert('Kiểm tra kết nối thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const install3Proxy = async (serverId: number) => {
    if (!confirm('Bạn có chắc muốn cài đặt 3proxy? Quá trình này có thể mất vài phút.')) {
      return;
    }

    setActionLoading(serverId);
    setServers(prev => prev.map(server =>
      server.id === serverId
        ? { ...server, status: 'INSTALLING' }
        : server
    ));

    try {
      const response = await api.post<{ success: boolean; message: string; status: string }>(`/api/admin/servers/${serverId}/install`);

      setServers(prev => prev.map(server =>
        server.id === serverId
          ? { ...server, status: response.status as Server['status'] }
          : server
      ));

      alert(response.message);
    } catch (error) {
      alert('Cài đặt thất bại');
      setServers(prev => prev.map(server =>
        server.id === serverId
          ? { ...server, status: 'ERROR' }
          : server
      ));
    } finally {
      setActionLoading(null);
    }
  };

  const filteredServers = servers.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.host.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Quản lý máy chủ</h1>
          <p className="mt-0.5 lg:mt-1 text-sm text-gray-600">
            {servers.length} máy chủ trong hệ thống
          </p>
        </div>
        <Link
          href="/admin/servers/create"
          className="inline-flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
        >
          <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          <span className="hidden sm:inline">Thêm máy chủ</span>
          <span className="sm:hidden">Thêm</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-3 py-1.5 lg:pr-4 lg:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Servers Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredServers.length === 0 ? (
          <div className="text-center py-12">
            <Server className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              {searchTerm ? 'Không tìm thấy máy chủ' : 'Chưa có máy chủ'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Thử tìm kiếm với từ khóa khác' : 'Bắt đầu bằng cách thêm máy chủ mới'}
            </p>
            {!searchTerm && (
              <Link
                href="/admin/servers/create"
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm máy chủ
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Máy chủ
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">
                    SSH Info
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Port Range
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Proxy
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredServers.map((server) => {
                  const status = getStatusConfig(server.status);
                  const StatusIcon = status.icon;
                  const isLoading = actionLoading === server.id;

                  return (
                    <tr key={server.id} className="hover:bg-gray-50">
                      <td className="px-3 lg:px-6 py-2 lg:py-4">
                        <div className="flex items-center gap-2 lg:gap-3">
                          <div className="p-1.5 lg:p-2 bg-blue-50 rounded-lg flex-shrink-0">
                            <Server className="h-4 w-4 lg:h-5 lg:w-5 text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm lg:font-medium text-gray-900 truncate">{server.name}</p>
                            <p className="text-xs text-gray-500 truncate">{server.host}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 lg:px-6 py-2 lg:py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full text-xs font-medium border ${status.color}`}>
                          {isLoading ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <StatusIcon className="h-3 w-3" />
                          )}
                          <span className="hidden sm:inline">{status.label}</span>
                        </span>
                      </td>
                      <td className="px-3 lg:px-6 py-2 lg:py-4 hidden sm:table-cell">
                        <div className="text-xs lg:text-sm text-gray-600">
                          <p>Port: {server.sshPort}</p>
                          <p className="text-gray-400 hidden lg:block">{server.sshUsername}</p>
                        </div>
                      </td>
                      <td className="px-3 lg:px-6 py-2 lg:py-4">
                        <span className="text-xs lg:text-sm font-medium text-gray-900">
                          {server.proxyPortStart}-{server.proxyPortEnd}
                        </span>
                      </td>
                      <td className="px-3 lg:px-6 py-2 lg:py-4">
                        <div className="flex items-center gap-1 text-xs lg:text-sm text-gray-600">
                          <Zap className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-amber-500" />
                          {server._count.proxies}
                        </div>
                      </td>
                      <td className="px-3 lg:px-6 py-2 lg:py-4 text-right">
                        <div className="flex items-center justify-end gap-1 lg:gap-2">
                          {server.status === 'ACTIVE' ? (
                            <>
                              <Link
                                href={`/admin/servers/${server.id}`}
                                className="p-1.5 lg:p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Quản lý"
                              >
                                <Settings className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                              </Link>
                              <Link
                                href={`/admin/servers/${server.id}/edit`}
                                className="p-1.5 lg:p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                title="Sửa"
                              >
                                <Pencil className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                              </Link>
                              <button
                                onClick={() => testConnection(server.id)}
                                disabled={isLoading}
                                className="p-1.5 lg:p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 hidden sm:block"
                                title="Kiểm tra kết nối"
                              >
                                <Activity className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                              </button>
                            </>
                          ) : server.status === 'INSTALLING' ? (
                            <span className="text-xs lg:text-sm text-gray-500">
                              <RefreshCw className="h-3.5 w-3.5 lg:h-4 lg:w-4 inline animate-spin" />
                            </span>
                          ) : (
                            <button
                              onClick={() => install3Proxy(server.id)}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1 px-2 lg:px-3 py-1 lg:py-1.5 text-xs lg:text-sm font-medium text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Zap className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                              <span className="hidden sm:inline">Cài đặt</span>
                            </button>
                          )}
                          <Link
                            href={`/admin/servers/${server.id}`}
                            className="p-1.5 lg:p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <ArrowRight className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
