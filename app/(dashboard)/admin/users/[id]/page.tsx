'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  User,
  Shield,
  Mail,
  Calendar,
  Zap,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
  Globe,
  Clock,
  ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Proxy {
  id: number;
  port: number;
  protocol: 'HTTP' | 'SOCKS4' | 'SOCKS5';
  username?: string;
  password?: string;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  server: {
    id: number;
    name: string;
    host: string;
  };
}

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  
  const [user, setUser] = useState<User | null>(null);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const hasFetched = useRef(false);

  const userId = parseInt(params.id as string);

  useEffect(() => {
    if (userId && !hasFetched.current) {
      hasFetched.current = true;
      fetchUser();
      fetchUserProxies();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await api.get<{ user: User }>(`/api/admin/users/${userId}`);
      setUser(response.user);
    } catch (error) {
      setError('Không thể tải thông tin người dùng');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProxies = async () => {
    try {
      const response = await api.get<{ proxies: Proxy[] }>(`/api/admin/users/${userId}/proxies`);
      setProxies(response.proxies);
    } catch (error) {
      console.error('Failed to fetch user proxies:', error);
    }
  };

  const toggleUserStatus = async (isActive: boolean) => {
    setActionLoading(true);
    try {
      await api.patch(`/api/admin/users/${userId}`, { isActive });
      setUser(prev => prev ? { ...prev, isActive } : null);
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const deleteUser = async () => {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return;
    
    setActionLoading(true);
    try {
      await api.delete(`/api/admin/users/${userId}`);
      router.push('/admin/users');
    } catch (error) {
      console.error('Failed to delete user:', error);
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-4 lg:p-8">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg">
          {error || 'Không tìm thấy người dùng'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/users"
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl lg:text-2xl font-bold text-gray-900 flex items-center gap-2">
              {user.name}
              {user.role === 'ADMIN' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  <Shield className="h-3 w-3" />
                  ADMIN
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleUserStatus(!user.isActive)}
            disabled={actionLoading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              user.isActive
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            } disabled:opacity-50`}
          >
            {user.isActive ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
            {user.isActive ? 'Khóa tài khoản' : 'Kích hoạt'}
          </button>
          {user.role !== 'ADMIN' && (
            <button
              onClick={deleteUser}
              disabled={actionLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              Xóa
            </button>
          )}
        </div>
      </div>

      {/* User Info Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium text-gray-900 truncate">{user.email}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${user.role === 'ADMIN' ? 'bg-purple-50' : 'bg-blue-50'}`}>
              <Shield className={`h-5 w-5 ${user.role === 'ADMIN' ? 'text-purple-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vai trò</p>
              <p className="font-medium text-gray-900">
                {user.role === 'ADMIN' ? 'Quản trị viên' : 'Khách hàng'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${user.isActive ? 'bg-emerald-50' : 'bg-red-50'}`}>
              {user.isActive ? <CheckCircle className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
            </div>
            <div>
              <p className="text-sm text-gray-500">Trạng thái</p>
              <p className="font-medium text-gray-900">
                {user.isActive ? 'Hoạt động' : 'Đã khóa'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Zap className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Proxy</p>
              <p className="font-medium text-gray-900">{proxies.length} proxy</p>
            </div>
          </div>
        </div>
      </div>

      {/* Proxies List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 lg:px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Proxy được gán</h2>
        </div>
        
        {proxies.length === 0 ? (
          <div className="text-center py-12">
            <Zap className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-medium text-gray-900">Chưa có proxy</h3>
            <p className="mt-1 text-sm text-gray-500">Người dùng này chưa được gán proxy nào</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {proxies.map((proxy, index) => {
              const isFirst = index === 0;
              const isLast = index === proxies.length - 1;
              
              return (
                <div
                  key={proxy.id}
                  className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 lg:px-6 py-3 hover:bg-gray-50 transition-colors ${
                    isFirst ? 'rounded-t-xl' : ''
                  } ${isLast ? 'rounded-b-xl' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <Globe className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{proxy.server.name}</span>
                        <span className="text-sm text-gray-500">{proxy.server.host}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Port: {proxy.port}</span>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {proxy.protocol}
                        </span>
                        {proxy.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle className="h-3 w-3" />
                            Hoạt động
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-red-600">
                            <XCircle className="h-3 w-3" />
                            Tắt
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    {proxy.expiresAt && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Hết hạn: {new Date(proxy.expiresAt).toLocaleDateString('vi-VN')}
                      </span>
                    )}
                    <Link
                      href={`/admin/servers/${proxy.server.id}`}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Xem server"
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Created Date */}
      <div className="text-sm text-gray-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          Ngày tạo: {new Date(user.createdAt).toLocaleDateString('vi-VN')}
        </span>
      </div>
    </div>
  );
}
