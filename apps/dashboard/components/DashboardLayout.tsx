'use client';

import React, { useState, useEffect } from 'react';
import { Menu, Globe, Bell, Search, User } from 'lucide-react';
import Sidebar from './Sidebar';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile sidebar on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans antialiased text-slate-900">
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45] lg:hidden transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar - Desktop isExpanded / Mobile isMobileOpen */}
      <Sidebar 
        isExpanded={isExpanded} 
        onToggle={() => setIsExpanded(!isExpanded)} 
        onClose={() => setIsMobileOpen(false)} 
      />
      
      {/* Dynamic padding/transform for sidebar state on mobile */}
      <div className={`fixed inset-0 bg-slate-900/60 z-[45] lg:hidden transition-opacity duration-300 ${isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} 
           onClick={() => setIsMobileOpen(false)} />
      
      <div className={`flex-1 flex flex-col min-w-0 h-full transition-all duration-300 ${isMobileOpen ? 'translate-x-64 lg:translate-x-0' : ''}`}>
        {/* Top Header */}
        <header className="h-20 flex items-center justify-between px-6 bg-white border-b border-slate-200 z-30 sticky top-0">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsMobileOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="hidden md:flex items-center bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 w-64 lg:w-96 group focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-slate-400 mr-2" />
              <input 
                type="text" 
                placeholder="Tìm kiếm nhanh..." 
                className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3 md:space-x-4">
            <button className="p-2.5 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
            <div className="h-8 w-[1px] bg-slate-200 hidden sm:block"></div>
            <div className="flex items-center space-x-3 pl-2">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-bold text-slate-900 leading-none mb-1">Duy Admin</p>
                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-tighter">Hệ thống Manager</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 border-2 border-white">
                D
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] custom-scrollbar">
          <div className="p-6 md:p-8 lg:p-10 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
