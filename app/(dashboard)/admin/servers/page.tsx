'use client';

import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
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
  Pencil,
  ShieldAlert,
  CalendarClock,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  Trash2,
  Eye,
  ChevronDown,
  ArrowRightLeft
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
  lastChecked: string | null;
  createdAt: string;
  updatedAt: string;
  _count: {
    proxies: number;
  };
}

export default function ServersPage() {
  const { user } = useAuthStore();
  const { success, error: toastError } = useToast();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Confirm modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'primary' | 'warning';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'danger',
  });
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);
  const itemsPerPage = 10;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setOpenMenuId(null);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(target)) {
        setFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const statusOptions = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'ACTIVE', label: 'Hoạt động' },
    { value: 'PENDING', label: 'Chờ xử lý' },
    { value: 'INSTALLING', label: 'Đang cài đặt' },
    { value: 'ERROR', label: 'Lỗi' },
    { value: 'OFFLINE', label: 'Offline' },
  ];

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchServers();
    }
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

      success(response.message);
    } catch (error) {
      toastError('Kiểm tra kết nối thất bại');
    } finally {
      setActionLoading(null);
    }
  };

  const install3Proxy = async (serverId: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'Cài đặt 3proxy',
      message: 'Bạn có chắc muốn cài đặt 3proxy? Quá trình này có thể mất vài phút.',
      variant: 'primary',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
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

          success(response.message);
        } catch (error) {
          toastError('Cài đặt thất bại');
          setServers(prev => prev.map(server =>
            server.id === serverId
              ? { ...server, status: 'ERROR' }
              : server
          ));
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const deleteServer = async (serverId: number, proxyCount: number) => {
    if (proxyCount > 0) {
      toastError('Không thể xóa máy chủ đang có proxy. Vui lòng xóa tất cả proxy trước.');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Xóa máy chủ',
      message: 'Bạn có chắc muốn xóa máy chủ này? Hành động này không thể hoàn tác.',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          await api.delete(`/api/admin/servers/${serverId}`);
          setServers(prev => prev.filter(server => server.id !== serverId));
          success('Đã xóa máy chủ');
        } catch (error) {
          toastError('Không thể xóa máy chủ');
        }
      },
    });
  };

  // Filter servers by search and status
  const filteredServers = servers.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.host.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredServers.length / itemsPerPage);
  const paginatedServers = filteredServers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Format last checked time to relative time
  const formatLastChecked = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) return 'Hôm qua';
    return `${diffDays} ngày trước`;
  };

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

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-3 py-1.5 lg:pr-4 lg:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
        {/* Status Filter Dropdown */}
        <div ref={filterDropdownRef}>
          <div className="relative">
            <button
            onClick={() => setFilterDropdownOpen(!filterDropdownOpen)}
            className="inline-flex items-center justify-between gap-2 px-3 py-1.5 lg:py-2 w-48 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <span className="flex items-center gap-2 truncate">
              <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <span className="truncate">{statusOptions.find(opt => opt.value === statusFilter)?.label}</span>
            </span>
            <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ${filterDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {filterDropdownOpen && (
            <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-56 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-[99]">
              <div className="py-1">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setStatusFilter(option.value);
                      setCurrentPage(1);
                      setFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm ${
                      statusFilter === option.value
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Servers List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filteredServers.length === 0 ? (
          <div className="text-center py-12">
            <Server className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              {searchTerm || statusFilter !== 'ALL' ? 'Không tìm thấy máy chủ' : 'Chưa có máy chủ'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'ALL' ? 'Thử thay đổi bộ lọc' : 'Bắt đầu bằng cách thêm máy chủ mới'}
            </p>
            {!searchTerm && statusFilter === 'ALL' && (
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
          <div className="">
            {/* Header Row */}
            <div className="hidden lg:grid lg:grid-cols-12 rounded-t-xl gap-4 px-4 py-3 border-b border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
              <div className="col-span-3">Máy chủ</div>
              <div className="col-span-2">Trạng thái</div>
              <div className="col-span-2">SSH Info</div>
              <div className="col-span-2">Kiểm tra</div>
              <div className="col-span-1">Port Range</div>
              <div className="col-span-1">Proxy</div>
              <div className="col-span-1 text-right">Thao tác</div>
            </div>

            {/* Server Rows */}
            {paginatedServers.map((server, index) => {
              const status = getStatusConfig(server.status);
              const StatusIcon = status.icon;
              const isLoading = actionLoading === server.id;
              const isFirst = index === 0;
              const isLast = index === paginatedServers.length - 1;

              return (
                <div
                  key={server.id}
                  className={`group relative flex flex-col lg:grid lg:grid-cols-12 gap-2 lg:gap-4 px-3 lg:px-4 py-3 lg:py-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 ${
                    isFirst ? 'rounded-t-xl lg:rounded-t-none' : ''
                  } ${isLast ? 'rounded-b-xl lg:rounded-b-none' : ''}`}
                >
                  {/* Mobile: Dropdown in top-right corner */}
                  <div className="lg:hidden absolute top-3 right-3">
                    <div className="relative dropdown-menu">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === server.id ? null : server.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Thao tác"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === server.id && (
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] py-1">
                          <Link
                            href={`/admin/servers/${server.id}`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Eye className="h-4 w-4" />
                            Xem chi tiết
                          </Link>
                          <Link
                            href={`/admin/servers/${server.id}/edit`}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Pencil className="h-4 w-4" />
                            Chỉnh sửa
                          </Link>
                          {server.status === 'ACTIVE' && (
                            <>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  testConnection(server.id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Activity className="h-4 w-4" />
                                Kiểm tra
                              </button>
                              <button
                                onClick={() => {
                                  setOpenMenuId(null);
                                  install3Proxy(server.id);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <Zap className="h-4 w-4" />
                                Cài 3proxy
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              deleteServer(server.id, server._count.proxies);
                            }}
                            // disabled={server._count.proxies > 0}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:text-gray-400"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Line 1: Server Name + Status + Proxy Count (Mobile) / Server Info (Desktop) */}
                  <div className="lg:col-span-3 flex items-center gap-2 pr-10 lg:pr-0">
                    <Link 
                      href={`/admin/servers/${server.id}`}
                      className="p-2 bg-blue-50 rounded-lg flex-shrink-0 hover:bg-blue-100 transition-colors"
                    >
                      <Server className="h-5 w-5 text-blue-600" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/admin/servers/${server.id}`}
                          className="text-sm font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors"
                        >
                          {server.name}
                        </Link>
                        {/* Mobile: Status icon only */}
                        <span className={`lg:hidden inline-flex items-center gap-1 px-0.5 py-0.5 rounded-full text-[10px] font-medium border ${status.color}`}>
                          {isLoading ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <StatusIcon className="h-3 w-3" />
                          )}
                        </span>
                        {/* Mobile: Proxy count */}
                        <span className="lg:hidden flex items-center gap-0.5 text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span className="font-medium">{server._count.proxies}</span>
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{server.host}:{server.sshPort}</p>
                    </div>
                  </div>

                  {/* Status - Desktop only */}
                  <div className="hidden lg:col-span-2 lg:flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${status.color}`}>
                      {isLoading ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <StatusIcon className="h-3 w-3" />
                      )}
                      <span>{status.label}</span>
                    </span>
                  </div>

                  {/* SSH Info - Desktop only */}
                  <div className="hidden lg:col-span-2 lg:block text-sm text-gray-600">
                    <p>Port: {server.sshPort}</p>
                    <p className="text-gray-400 text-xs">{server.sshUsername}</p>
                  </div>

                  {/* Last Checked - Desktop only */}
                  <div className="hidden lg:col-span-2 lg:flex items-center text-sm text-gray-500">
                    {server.lastChecked ? (
                      <>
                        <CalendarClock className="h-3.5 w-3.5 mr-1" />
                        {formatLastChecked(server.lastChecked)}
                      </>
                    ) : (
                      <span className="text-gray-400 text-xs">Chưa kiểm tra</span>
                    )}
                  </div>

                  {/* Port Range + Proxy Count - Desktop */}
                  <div className="hidden lg:col-span-1 lg:flex items-center gap-3">
                    <span className="text-sm text-gray-600">
                      {server.proxyPortStart}-{server.proxyPortEnd}
                    </span>
                  </div>

                  {/* Port Range + Proxy Count - Desktop */}
                  <div className="hidden lg:col-span-1 lg:flex items-center gap-3">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <span className="font-medium">{server._count.proxies}</span>
                    </div>
                  </div>

                  {/* Line 3: Port Range (Mobile only) */}
                  <div className="lg:hidden flex items-center gap-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1 bg-gray-100 px-1.5 py-0.5 rounded">
                      <ArrowRightLeft className="h-3 w-3 text-gray-500" />
                      <span className="font-medium text-gray-700">{server.proxyPortStart}-{server.proxyPortEnd}</span>
                    </span>
                    {server.lastChecked && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {formatLastChecked(server.lastChecked)}
                      </span>
                    )}
                  </div>

                  {/* Actions - Desktop only */}
                  <div className="hidden lg:col-span-1 lg:flex items-center justify-end gap-0.5">
                    {server.status === 'ACTIVE' && (
                      <>
                        <button
                          onClick={() => testConnection(server.id)}
                          disabled={isLoading}
                          className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                          title="Kiểm tra kết nối"
                        >
                          <Activity className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => install3Proxy(server.id)}
                          disabled={isLoading}
                          className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Cài đặt 3proxy"
                        >
                          <Zap className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {server.status === 'INSTALLING' && (
                      <span className="p-1.5" title="Đang cài đặt">
                        <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />
                      </span>
                    )}
                    {(server.status === 'PENDING' || server.status === 'OFFLINE' || server.status === 'ERROR') && (
                      <button
                        onClick={() => install3Proxy(server.id)}
                        disabled={isLoading}
                        className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Cài đặt 3proxy"
                      >
                        <Zap className="h-4 w-4" />
                      </button>
                    )}

                    {/* Desktop Dropdown */}
                    <div className="relative dropdown-menu" style={{ position: 'relative', zIndex: 50 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === server.id ? null : server.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Thao tác"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                      {openMenuId === server.id && (
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] py-1">
                          <Link
                            href={`/admin/servers/${server.id}`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Eye className="h-4 w-4" />
                            Xem chi tiết
                          </Link>
                          <Link
                            href={`/admin/servers/${server.id}/edit`}
                            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            onClick={() => setOpenMenuId(null)}
                          >
                            <Pencil className="h-4 w-4" />
                            Chỉnh sửa
                          </Link>
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              deleteServer(server.id, server._count.proxies);
                            }}
                            // disabled={server._count.proxies > 0}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:text-gray-400"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa máy chủ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 lg:px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredServers.length)} / {filteredServers.length} máy chủ
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText="Xác nhận"
        cancelText="Hủy"
      />
    </div>
  );
}
