'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Globe, Clock, Server, Activity, BarChart3, Settings, ChevronDown, Menu } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle }) => {
  const pathname = usePathname();
  
  const menuItems = [
    { icon: Activity, label: 'Tổng quan', href: '/' },
    { icon: Globe, label: 'Proxy', href: '/proxy' },
    { icon: Server, label: 'Nodes', href: '/nodes' },
    { icon: BarChart3, label: 'Khu vực', href: '/regions' },
    { icon: Activity, label: 'Sự kiện', href: '/events' },
    { icon: Activity, label: 'Lưu lượng', href: '/traffic' },
    { icon: Settings, label: 'Cài đặt', href: '/settings' },
  ].map(item => ({
    ...item,
    active: pathname === item.href
  }));

  return (
    <div className={`bg-gray-900 border-r border-gray-800 transition-all duration-300 ${isOpen ? 'w-64' : 'w-20'}`}>
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            {isOpen && (
              <span className="text-lg font-semibold text-white">Proxy Manager</span>
            )}
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded-md hover:bg-gray-800 lg:hidden"
          >
            <Menu className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {menuItems.map((item, index) => (
              <li key={index}>
                <Link
                  href={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    item.active
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {isOpen && <span>{item.label}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Section */}
        {isOpen && (
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-gray-300">A</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">admin</p>
                <p className="text-xs text-gray-400">Quản trị viên</p>
              </div>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
