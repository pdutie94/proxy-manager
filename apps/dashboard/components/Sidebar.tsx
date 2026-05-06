'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Globe, Clock, Server, Activity, BarChart3, Settings, 
  ChevronLeft, ChevronRight, Shield, LayoutDashboard,
  LogOut, User
} from 'lucide-react';

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isExpanded, onToggle, onClose }) => {
  const pathname = usePathname();
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Tổng quan', href: '/' },
    { icon: Shield, label: 'Quản lý Proxy', href: '/proxy' },
    { icon: Server, label: 'Quản lý Nodes', href: '/nodes' },
    { icon: Globe, label: 'Khu vực', href: '/regions' },
    { icon: Clock, label: 'Lịch sử sự kiện', href: '/events' },
    { icon: BarChart3, label: 'Thống kê lưu lượng', href: '/traffic' },
    { icon: Settings, label: 'Cài đặt hệ thống', href: '/settings' },
  ].map(item => ({
    ...item,
    active: pathname === item.href
  }));

  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out
      bg-[#0f172a] border-r border-slate-800 flex flex-col h-full shadow-xl overflow-x-hidden
      ${isExpanded ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0 lg:w-20'}
    `}>
      {/* Brand Logo */}
      <div className={`flex items-center border-b border-slate-800 h-20 ${!isExpanded ? 'justify-center px-4 py-2' : 'justify-between px-6 py-5'}`}>
        <div className="flex items-center space-x-3 overflow-hidden">
          <div className="w-10 h-10 min-w-[2.5rem] bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Globe className="w-6 h-6 text-white" />
          </div>
          {isExpanded && (
            <div className="flex flex-col transition-all duration-300">
              <span className="text-lg font-bold text-white leading-tight">ANTIGRAVITY</span>
              <span className="text-[10px] font-medium text-blue-400 tracking-widest uppercase">Proxy Manager</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar overflow-x-hidden">
        {isExpanded && (
          <div className="mb-4 px-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
            Menu chính
          </div>
        )}
        <ul className="space-y-1.5">
          {menuItems.map((item, index) => (
            <li key={index}>
              <Link
                href={item.href}
                onClick={() => {
                  if (window.innerWidth < 1024) onClose();
                }}
                className={`flex items-center px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  item.active
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 font-medium'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                } ${!isExpanded ? 'justify-center' : 'space-x-3'}`}
              >
                <item.icon className={`w-5 h-5 min-w-[1.25rem] transition-transform duration-200 group-hover:scale-110 ${
                  item.active ? 'text-white' : 'group-hover:text-white'
                }`} />
                
                {isExpanded && (
                  <span className="transition-all duration-300 whitespace-nowrap overflow-hidden w-auto opacity-100">
                    {item.label}
                  </span>
                )}
                
                {/* Tooltip for collapsed state */}
                {!isExpanded && (
                  <div className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-[60] lg:block hidden border border-slate-700 shadow-xl">
                    {item.label}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer Actions & Profile */}
      <div className="p-4 border-t border-slate-800 space-y-4">
        

        {/* Collapse Toggle Button (Desktop only) */}
        <button
          onClick={onToggle}
          className="hidden lg:flex items-center justify-center w-full py-2 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50 text-slate-400 hover:text-white transition-all group"
        >
          {isExpanded ? (
            <div className="flex items-center space-x-2">
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="text-xs font-medium">Thu gọn</span>
            </div>
          ) : (
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
