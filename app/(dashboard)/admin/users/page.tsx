'use client';

import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Filter,
  Shield,
  UserCog,
  CheckCircle,
  XCircle,
  Trash2,
  Zap,
  Eye,
  ChevronDown,
  Pencil
} from 'lucide-react';
import Link from 'next/link';

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  _count: {
    proxies: number;
  };
}

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const hasFetched = useRef(false);
  const itemsPerPage = 10;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dropdown-menu')) {
        setOpenMenuId(null);
      }
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(target)) {
        setRoleDropdownOpen(false);
      }
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(target)) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const roleOptions = [
    { value: 'ALL', label: 'Tất cả vai trò' },
    { value: 'ADMIN', label: 'Quản trị' },
    { value: 'CUSTOMER', label: 'Khách hàng' },
  ];

  const statusOptions = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'ACTIVE', label: 'Hoạt động' },
    { value: 'INACTIVE', label: 'Đã khóa' },
  ];

  useEffect(() => {
    if (!hasFetched.current) {
      hasFetched.current = true;
      fetchUsers();
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get<{ users: User[] }>('/api/admin/users');
      setUsers(response.users);
    } catch (error) {
      setError('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const createUser = async (userData: any) => {
    try {
      const response = await api.post<{ user: User }>('/api/admin/users', userData);
      setUsers(prev => [...prev, response.user]);
      setShowCreateForm(false);
    } catch (error) {
      alert('Không thể tạo người dùng');
    }
  };

  const toggleUserStatus = async (userId: number, isActive: boolean) => {
    try {
      const response = await api.put<{ user: User }>(`/api/admin/users/${userId}`, { isActive });
      setUsers(prev => prev.map(user =>
        user.id === userId ? response.user : user
      ));
    } catch (error) {
      alert('Không thể cập nhật trạng thái');
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Bạn có chắc muốn xóa người dùng này?')) {
      return;
    }

    try {
      await api.delete(`/api/admin/users/${userId}`);
      setUsers(prev => prev.filter(user => user.id !== userId));
    } catch (error) {
      alert('Không thể xóa người dùng');
    }
  };

  // Filter users by search, role, and status
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || 
      (statusFilter === 'ACTIVE' && u.isActive) ||
      (statusFilter === 'INACTIVE' && !u.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
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
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Quản lý người dùng</h1>
          <p className="mt-0.5 lg:mt-1 text-sm text-gray-600">
            {users.length} người dùng trong hệ thống
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-1.5 lg:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm lg:text-base"
        >
          <Plus className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
          <span className="hidden sm:inline">Thêm người dùng</span>
          <span className="sm:hidden">Thêm</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <CreateUserForm
          onSubmit={createUser}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
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
        {/* Filter Dropdowns */}
        <div className="flex items-center gap-2">
          {/* Role Filter */}
          <div ref={roleDropdownRef} className="relative">
            <button
              onClick={() => {
                setRoleDropdownOpen(!roleDropdownOpen);
                setStatusDropdownOpen(false);
              }}
              className="inline-flex items-center justify-between gap-2 px-3 py-1.5 lg:py-2 w-40 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="flex items-center gap-2 truncate">
                <Shield className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="truncate hidden sm:inline">{roleOptions.find(opt => opt.value === roleFilter)?.label}</span>
                <span className="sm:hidden">{roleFilter === 'ALL' ? 'Vai trò' : roleFilter === 'ADMIN' ? 'Admin' : 'Khách'}</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ${roleDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {roleDropdownOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {roleOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setRoleFilter(option.value);
                        setCurrentPage(1);
                        setRoleDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm ${
                        roleFilter === option.value
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

          {/* Status Filter */}
          <div ref={statusDropdownRef} className="relative">
            <button
              onClick={() => {
                setStatusDropdownOpen(!statusDropdownOpen);
                setRoleDropdownOpen(false);
              }}
              className="inline-flex items-center justify-between gap-2 px-3 py-1.5 lg:py-2 w-40 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <span className="flex items-center gap-2 truncate">
                <Filter className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="truncate hidden sm:inline">{statusOptions.find(opt => opt.value === statusFilter)?.label}</span>
                <span className="sm:hidden">{statusFilter === 'ALL' ? 'Trạng thái' : statusFilter === 'ACTIVE' ? 'Hoạt động' : 'Khóa'}</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform flex-shrink-0 ${statusDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {statusDropdownOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-48 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  {statusOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setStatusFilter(option.value);
                        setCurrentPage(1);
                        setStatusDropdownOpen(false);
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

      {/* Users List */}
      <div className="bg-white rounded-xl border border-gray-200">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? 'Không tìm thấy người dùng' : 'Chưa có người dùng'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? 'Thử thay đổi bộ lọc' : 'Bắt đầu bằng cách thêm người dùng mới'}
            </p>
            {!searchTerm && roleFilter === 'ALL' && statusFilter === 'ALL' && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm người dùng
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Header Row */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-4 py-3 rounded-t-xl bg-gray-50 text-xs border-b border-gray-200 font-semibold text-gray-500 uppercase">
              <div className="col-span-3">Người dùng</div>
              <div className="col-span-2">Vai trò</div>
              <div className="col-span-2">Trạng thái</div>
              <div className="col-span-2">Proxy</div>
              <div className="col-span-2">Ngày tạo</div>
              <div className="col-span-1 text-right">Thao tác</div>
            </div>

            {/* User Rows */}
            {paginatedUsers.map((userItem, index) => {
              const isFirst = index === 0;
              const isLast = index === paginatedUsers.length - 1;
              
              return (
              <div
                key={userItem.id}
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
                        setOpenMenuId(openMenuId === userItem.id ? null : userItem.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Thao tác"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenuId === userItem.id && (
                      <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] py-1">
                        <Link
                          href={`/admin/users/${userItem.id}`}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setOpenMenuId(null)}
                        >
                          <Eye className="h-4 w-4" />
                          Xem chi tiết
                        </Link>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            toggleUserStatus(userItem.id, !userItem.isActive);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {userItem.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          {userItem.isActive ? 'Khóa tài khoản' : 'Kích hoạt'}
                        </button>
                        {userItem.role !== 'ADMIN' && (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              deleteUser(userItem.id);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Line 1: User Info */}
                <div className="lg:col-span-3 flex items-center gap-2 pr-10 lg:pr-0">
                  <div className="min-w-0 flex-1">
                    <Link 
                      href={`/admin/users/${userItem.id}`}
                      className="text-sm font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors block"
                    >
                      {userItem.name}
                    </Link>
                    <p className="text-xs text-gray-500 truncate">{userItem.email}</p>
                  </div>
                </div>

                {/* Line 2: Role + Status + Proxy Count */}
                <div className="lg:col-span-2 flex items-center gap-2 lg:gap-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    userItem.role === 'ADMIN'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}>
                    {userItem.role === 'ADMIN' ? <Shield className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
                    <span className="hidden sm:inline">{userItem.role === 'ADMIN' ? 'Quản trị' : 'Khách hàng'}</span>
                  </span>
                  
                  {/* Mobile proxy count */}
                  <span className="lg:hidden flex items-center gap-1 text-xs text-gray-600">
                    <Zap className="h-3 w-3 text-amber-500" />
                    {userItem._count?.proxies ?? 0}
                  </span>
                </div>

                {/* Status - Desktop */}
                <div className="hidden lg:col-span-2 lg:flex items-center">
                  <button
                    onClick={() => toggleUserStatus(userItem.id, !userItem.isActive)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      userItem.isActive
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {userItem.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {userItem.isActive ? 'Hoạt động' : 'Đã khóa'}
                  </button>
                </div>

                {/* Proxy Count - Desktop */}
                <div className="hidden lg:col-span-2 lg:flex items-center text-sm text-gray-600">
                  <Zap className="h-4 w-4 text-amber-500 mr-1" />
                  {userItem._count?.proxies ?? 0} proxy
                </div>

                {/* Created Date - Desktop */}
                <div className="hidden lg:col-span-2 lg:flex items-center text-sm text-gray-500">
                  {new Date(userItem.createdAt).toLocaleDateString('vi-VN')}
                </div>

                {/* Line 3: Mobile extra info */}
                <div className="lg:hidden flex items-center gap-2 text-xs text-gray-500">
                  <span>{new Date(userItem.createdAt).toLocaleDateString('vi-VN')}</span>
                  <button
                    onClick={() => toggleUserStatus(userItem.id, !userItem.isActive)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      userItem.isActive
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {userItem.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    {userItem.isActive ? 'Hoạt động' : 'Đã khóa'}
                  </button>
                </div>

                {/* Actions - Desktop only */}
                <div className="hidden lg:col-span-1 lg:flex items-center justify-end gap-0.5">
                  <button
                    onClick={() => toggleUserStatus(userItem.id, !userItem.isActive)}
                    className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    title={userItem.isActive ? 'Khóa tài khoản' : 'Kích hoạt'}
                  >
                    {userItem.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                  </button>
                  
                  <div className="relative dropdown-menu" style={{ position: 'relative', zIndex: 50 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === userItem.id ? null : userItem.id);
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Thao tác"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </button>
                    {openMenuId === userItem.id && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] py-1">
                        <Link
                          href={`/admin/users/${userItem.id}`}
                          className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => setOpenMenuId(null)}
                        >
                          <Eye className="h-4 w-4" />
                          Xem chi tiết
                        </Link>
                        <button
                          onClick={() => {
                            setOpenMenuId(null);
                            toggleUserStatus(userItem.id, !userItem.isActive);
                          }}
                          className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {userItem.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          {userItem.isActive ? 'Khóa tài khoản' : 'Kích hoạt'}
                        </button>
                        {userItem.role !== 'ADMIN' && (
                          <button
                            onClick={() => {
                              setOpenMenuId(null);
                              deleteUser(userItem.id);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa người dùng
                          </button>
                        )}
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
              Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredUsers.length)} / {filteredUsers.length} người dùng
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
    </div>
  );
}

// Create User Form Component
function CreateUserForm({ onSubmit, onCancel }: {
  onSubmit: (data: any) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 lg:p-6">
      <h2 className="text-sm lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Thêm người dùng mới</h2>
      <form onSubmit={handleSubmit} className="space-y-3 lg:space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Họ tên <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="Nguyễn Văn A"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="user@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-1.5 lg:py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              placeholder="••••••••"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Tạo người dùng
          </button>
        </div>
      </form>
    </div>
  );
}
