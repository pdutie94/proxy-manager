'use client';

import React from 'react';
import { Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';

interface EventData {
  id: string;
  type: 'CREATE_PROXY' | 'DELETE_PROXY' | 'RENEW_PROXY' | 'EXPIRED_PROXY';
  title: string;
  node: string;
  time: string;
  status: 'applied' | 'pending' | 'warning';
  timestamp: string;
}

interface RecentEventsPanelProps {
  events: EventData[];
}

const RecentEventsPanel: React.FC<RecentEventsPanelProps> = ({ events }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'CREATE_PROXY':
        return Plus;
      case 'DELETE_PROXY':
        return Trash2;
      case 'RENEW_PROXY':
        return RefreshCw;
      case 'EXPIRED_PROXY':
        return AlertTriangle;
      default:
        return AlertTriangle;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'warning':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'applied':
        return 'Đã áp dụng';
      case 'pending':
        return 'Đang chờ';
      case 'warning':
        return 'Cảnh báo';
      default:
        return 'Không xác định';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Sự kiện gần đây</h3>
        <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
          Xem tất cả
        </a>
      </div>

      <div className="space-y-4">
        {events.map((event) => {
          const Icon = getEventIcon(event.type);
          return (
            <div key={event.id} className="flex items-center space-x-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{event.title}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(event.status)}`}>
                    {getStatusText(event.status)}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-xs text-gray-500">
                  <span>#{event.id}</span>
                  <span>•</span>
                  <span>{event.node}</span>
                  <span>•</span>
                  <span>{event.time}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentEventsPanel;
