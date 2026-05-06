'use client';

import React from 'react';
import { Server, Wifi, Clock, RefreshCw, Activity } from 'lucide-react';

interface SystemStatusData {
  name: string;
  status: 'active' | 'connected' | 'pending' | 'running';
  description: string;
  value?: number;
}

interface SystemStatusPanelProps {
  systemStatus: SystemStatusData[];
}

const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({ systemStatus }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'connected':
      case 'running':
        return 'bg-green-500';
      case 'pending':
        return 'bg-orange-500';
      case 'error':
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getSystemIcon = (name: string) => {
    switch (name) {
      case 'API':
        return Server;
      case 'Redis Stream':
        return Wifi;
      case 'Agent Queue':
        return Clock;
      case 'Config Reload':
        return RefreshCw;
      case 'Traffic collection':
        return Activity;
      default:
        return Server;
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-lg font-semibold text-gray-900">Trạng thái hệ thống</h3>
      </div>

      <div className="space-y-0">
        {systemStatus.map((item, index) => {
          const Icon = getSystemIcon(item.name);
          return (
            <div key={index} className={`flex items-center justify-between py-3 ${index < systemStatus.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <div className="flex items-center space-x-3">
                <Icon className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-900">{item.name}</span>
              </div>
              <div className="flex items-center space-x-3 min-w-[120px] text-left">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(item.status)}`}></div>
                <span className="text-sm text-gray-600">{item.description}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SystemStatusPanel;
