'use client';

import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Trash2,
  UserCog,
  Mail,
  Shield,
  Zap
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

  useEffect(() => {
    fetchUsers();
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

  const filteredUsers = users.filter(u =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-3 py-1.5 lg:pr-4 lg:py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64 text-sm"
        />
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">
              {searchTerm ? 'Không tìm thấy người dùng' : 'Chưa có người dùng'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm ? 'Thử tìm kiếm với từ khóa khác' : 'Bắt đầu bằng cách thêm người dùng mới'}
            </p>
            {!searchTerm && (
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
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Người dùng
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Vai trò
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase">
                    Trạng thái
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase hidden md:table-cell">
                    Proxy
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-left text-xs font-semibold text-gray-500 uppercase hidden lg:table-cell">
                    Ngày tạo
                  </th>
                  <th className="px-3 lg:px-6 py-2 lg:py-4 text-right text-xs font-semibold text-gray-500 uppercase">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 lg:px-6 py-2 lg:py-4">
                      <div className="flex items-center gap-2 lg:gap-3">
                        <div className="h-8 w-8 lg:h-10 lg:w-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs lg:text-sm font-medium text-blue-600">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm lg:font-medium text-gray-900 truncate">{user.name}</p>
                          <p className="text-xs text-gray-500 truncate">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 lg:px-6 py-2 lg:py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full text-xs font-medium ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.role === 'ADMIN' ? <Shield className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
                        <span className="hidden sm:inline">{user.role === 'ADMIN' ? 'Quản trị' : 'Khách hàng'}</span>
                        <span className="sm:hidden">{user.role === 'ADMIN' ? 'Admin' : 'User'}</span>
                      </span>
                    </td>
                    <td className="px-3 lg:px-6 py-2 lg:py-4">
                      <button
                        onClick={() => toggleUserStatus(user.id, !user.isActive)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 lg:px-2.5 lg:py-1 rounded-full text-xs font-medium transition-colors ${
                          user.isActive
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                      >
                        {user.isActive ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                        <span className="hidden sm:inline">{user.isActive ? 'Hoạt động' : 'Đã khóa'}</span>
                        <span className="sm:hidden">{user.isActive ? 'Active' : 'Off'}</span>
                      </button>
                    </td>
                    <td className="px-3 lg:px-6 py-2 lg:py-4 hidden md:table-cell">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Zap className="h-3.5 w-3.5 lg:h-4 lg:w-4 text-amber-500" />
                        {user._count.proxies}
                      </div>
                    </td>
                    <td className="px-3 lg:px-6 py-2 lg:py-4 text-xs lg:text-sm text-gray-600 hidden lg:table-cell">
                      {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="px-3 lg:px-6 py-2 lg:py-4 text-right">
                      {user.role !== 'ADMIN' && (
                        <button
                          onClick={() => deleteUser(user.id)}
                          className="p-1.5 lg:p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Xóa người dùng"
                        >
                          <Trash2 className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
