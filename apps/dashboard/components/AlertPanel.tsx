'use client';

import React from 'react';
import { AlertTriangle, AlertCircle, Info, Bell } from 'lucide-react';

interface AlertData {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
  timestamp: string;
}

interface AlertPanelProps {
  alerts: AlertData[];
}

const AlertPanel: React.FC<AlertPanelProps> = ({ alerts }) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'error':
        return AlertTriangle;
      case 'warning':
        return AlertCircle;
      case 'info':
        return Info;
      default:
        return Bell;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'error':
        return 'bg-red-100 text-red-600 border-red-200';
      case 'warning':
        return 'bg-orange-100 text-orange-600 border-orange-200';
      case 'info':
        return 'bg-blue-100 text-blue-600 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Cảnh báo</h3>
        <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
          Xem tất cả
        </a>
      </div>

      <div className="space-y-4">
        {alerts.map((alert) => {
          const Icon = getAlertIcon(alert.type);
          return (
            <div key={alert.id} className="flex items-center space-x-4 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getAlertColor(alert.type)}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900">{alert.title}</span>
                  <span className="text-xs text-gray-500">{alert.time}</span>
                </div>
                <p className="text-xs text-gray-600">{alert.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AlertPanel;
