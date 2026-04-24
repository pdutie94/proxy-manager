'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAuthCheck } from '@/lib/auth-middleware';
import {
  LayoutDashboard,
  Users,
  Server,
  Plus,
  LogOut,
  Shield,
  UserCircle,
  Zap,
  ChevronRight,
  ChevronDown,
  Settings,
  Menu,
  X
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: { href: string; label: string }[];
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuthStore();
  const { isChecking } = useAuthCheck();
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>(['/admin/servers']);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';

  const toggleMenu = (href: string) => {
    setExpandedMenus(prev =>
      prev.includes(href) ? prev.filter(h => h !== href) : [...prev, href]
    );
  };

  const adminNavItems: NavItem[] = [
    { href: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
    { 
      href: '/admin/servers', 
      label: 'Máy chủ', 
      icon: Server,
      children: [
        { href: '/admin/servers', label: 'Danh sách máy chủ' },
        { href: '/admin/servers/create', label: 'Thêm máy chủ mới' },
      ]
    },
    { href: '/admin/users', label: 'Người dùng', icon: Users },
  ];

  const customerNavItems: NavItem[] = [
    { href: '/customer/proxies', label: 'Proxy của tôi', icon: Zap },
  ];

  const navItems = isAdmin ? adminNavItems : customerNavItems;

  const renderNavItem = (item: NavItem) => {
    const isActive = pathname?.startsWith(item.href);
    const isExpanded = expandedMenus.includes(item.href);
    const hasChildren = item.children && item.children.length > 0;
    const Icon = item.icon;

    return (
      <div key={item.href} className="space-y-1">
        {hasChildren ? (
          <>
            <button
              onClick={() => toggleMenu(item.href)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 ml-auto" />
              ) : (
                <ChevronRight className="h-4 w-4 ml-auto" />
              )}
            </button>
            {isExpanded && item.children && (
              <div className="ml-4 pl-4 border-l border-slate-700 space-y-1">
                {item.children.map((child) => {
                  const isChildActive = pathname === child.href;
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                        isChildActive
                          ? 'bg-blue-600/50 text-white'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <Link
            href={item.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-900 text-white z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-bold text-sm">Proxy Manager</h1>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 hover:bg-slate-800 rounded-lg"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`w-64 bg-slate-900 text-white flex flex-col fixed h-full z-40 transition-transform duration-300 lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Logo - desktop only */}
        <div className="hidden lg:block p-6 border-b border-slate-800">
          <Link href={isAdmin ? '/admin/dashboard' : '/customer/proxies'} className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Proxy Manager</h1>
              <p className="text-xs text-slate-400">
                {isAdmin ? 'Quản trị viên' : 'Khách hàng'}
              </p>
            </div>
          </Link>
        </div>

        {/* Spacer for mobile */}
        <div className="lg:hidden h-16"></div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(renderNavItem)}
        </nav>

        {/* User section */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-slate-800 rounded-full">
              <UserCircle className="h-5 w-5 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={() => useAuthStore.getState().logout()}
            className="flex items-center gap-2 w-full px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content - full width */}
      <main className="flex-1 lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-4 lg:p-8 w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
