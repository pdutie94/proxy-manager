'use client';

import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState, useRef } from 'react';
import {
  Users,
  Server,
  Zap,
  UserCheck,
  ArrowRight,
  Plus,
  Settings,
  TrendingUp
} from 'lucide-react';
import { api } from '@/lib/api';
import Link from 'next/link';

interface DashboardStats {
  totalUsers: number;
  totalServers: number;
  totalProxies: number;
  activeUsers: number;
}

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalServers: 0,
    totalProxies: 0,
    activeUsers: 0,
  });
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    
    const fetchStats = async () => {
      try {
        const [usersRes, serversRes] = await Promise.all([
          api.get<{ users: any[] }>('/api/admin/users'),
          api.get<{ servers: any[] }>('/api/admin/servers'),
        ]);

        const users = usersRes.users;
        const servers = serversRes.servers;
        const proxies = servers.reduce((acc, s) => acc + (s._count?.proxies || 0), 0);

        setStats({
          totalUsers: users.length,
          totalServers: servers.length,
          totalProxies: proxies,
          activeUsers: users.filter((u) => u.isActive).length,
        });
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Tổng người dùng',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      href: '/admin/users',
    },
    {
      title: 'Máy chủ',
      value: stats.totalServers,
      icon: Server,
      color: 'bg-emerald-500',
      href: '/admin/servers',
    },
    {
      title: 'Proxy',
      value: stats.totalProxies,
      icon: Zap,
      color: 'bg-amber-500',
      href: '/admin/servers',
    },
    {
      title: 'Người dùng hoạt động',
      value: stats.activeUsers,
      icon: UserCheck,
      color: 'bg-violet-500',
      href: '/admin/users',
    },
  ];

  const quickActions = [
    {
      title: 'Quản lý người dùng',
      description: 'Thêm, sửa, xóa tài khoản khách hàng',
      icon: Users,
      href: '/admin/users',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      title: 'Quản lý máy chủ',
      description: 'Cấu hình và giám sát máy chủ proxy',
      icon: Server,
      href: '/admin/servers',
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      title: 'Thêm máy chủ mới',
      description: 'Kết nối máy chủ mới vào hệ thống',
      icon: Plus,
      href: '/admin/servers/create',
      color: 'text-amber-600 bg-amber-50',
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Tổng quan</h1>
        <p className="mt-1 lg:mt-2 text-sm lg:text-base text-gray-600">
          Chào mừng trở lại, <span className="font-medium text-gray-900">{user?.name}</span>! 
          Đây là thông tin tổng quan về hệ thống proxy của bạn.
        </p>
      </div>

      {/* Stats Grid - Compact Modern Design */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.title}
              href={card.href}
              className="group relative bg-white p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-lg hover:shadow-gray-100/50 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden"
            >
              {/* Subtle gradient background on hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-200 ${card.color}`}></div>
              
              <div className="relative flex items-center gap-3">
                {/* Icon with gradient */}
                <div className={`${card.color} p-2.5 rounded-lg shadow-sm group-hover:shadow-md transition-shadow`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">{card.title}</p>
                  <p className="text-xl font-bold text-gray-900 tabular-nums">{card.value}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg lg:rounded-xl border border-gray-200">
        <div className="p-3 lg:p-6 border-b border-gray-100">
          <h3 className="text-base lg:text-lg font-semibold text-gray-900">Thao tác nhanh</h3>
          <p className="text-xs lg:text-sm text-gray-600 mt-0.5 lg:mt-1">
            Truy cập nhanh các chức năng thường dùng
          </p>
        </div>
        <div className="p-3 lg:p-6">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-3 lg:gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="flex items-start gap-3 lg:gap-4 p-3 lg:p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all group"
                >
                  <div className={`p-2 lg:p-3 rounded-lg ${action.color}`}>
                    <Icon className="h-4 w-4 lg:h-5 lg:w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm lg:font-medium text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                      {action.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-0.5 lg:mt-1 hidden lg:block">{action.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity Placeholder */}
      <div className="bg-white rounded-lg lg:rounded-xl border border-gray-200">
        <div className="p-3 lg:p-6 border-b border-gray-100">
          <h3 className="text-base lg:text-lg font-semibold text-gray-900">Hoạt động gần đây</h3>
        </div>
        <div className="p-3 lg:p-6">
          <div className="text-center py-6 lg:py-8">
            <TrendingUp className="h-10 w-10 lg:h-12 lg:w-12 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500 mt-2">Tính năng đang phát triển</p>
          </div>
        </div>
      </div>
    </div>
  );
}
