'use client';

import React from 'react';
import { Globe, Clock, Server, Layers } from 'lucide-react';

interface OverviewData {
  activeProxies: number;
  activeProxiesChange: number;
  pendingApplication: number;
  pendingApplicationPercentage: number;
  onlineNodes: number;
  totalNodes: number;
  onlineNodesPercentage: number;
  redisQueue: number;
  lastUpdated: string;
  systemActive: boolean;
}

interface OverviewCardsProps {
  data: OverviewData;
}

const OverviewCards: React.FC<OverviewCardsProps> = ({ data }) => {
  const cards = [
    {
      icon: Globe,
      title: 'Proxy đang hoạt động',
      value: data.activeProxies.toLocaleString(),
      change: `+${data.activeProxiesChange} trong giờ qua`,
      color: 'blue'
    },
    {
      icon: Clock,
      title: 'Đang chờ áp dụng',
      value: data.pendingApplication.toLocaleString(),
      change: `${data.pendingApplicationPercentage}% tổng số`,
      color: 'orange'
    },
    {
      icon: Server,
      title: 'Nodes trực tuyến',
      value: `${data.onlineNodes} / ${data.totalNodes}`,
      change: `${data.onlineNodesPercentage}% trực tuyến`,
      color: 'green'
    },
    {
      icon: Layers,
      title: 'Hàng đợi Redis',
      value: data.redisQueue.toLocaleString(),
      change: 'Sự kiện đang chờ',
      color: 'purple'
    }
  ];

  const getColorClasses = (color: string) => {
    const colors = {
      blue: 'bg-blue-100 text-blue-600',
      orange: 'bg-orange-100 text-orange-600', 
      green: 'bg-green-100 text-green-600',
      purple: 'bg-purple-100 text-purple-600'
    };
    return colors[color as keyof typeof colors] || colors.blue;
  };

  const getChangeTextColor = (color: string) => {
    switch (color) {
      case 'blue':
        return 'text-green-600';
      case 'orange':
        return 'text-orange-600';
      case 'green':
        return 'text-green-600';
      case 'purple':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tổng quan</h2>
          <p className="text-sm text-gray-500">
            Cập nhật lúc {new Date(data.lastUpdated).toLocaleTimeString('vi-VN')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${data.systemActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
          <span className="text-sm text-gray-600">
            {data.systemActive ? 'Hệ thống hoạt động' : 'Hệ thống lỗi'}
          </span>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-4">
              <div className={`w-12 h-12 rounded-lg ${getColorClasses(card.color)} flex items-center justify-center flex-shrink-0`}>
                <card.icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{card.title}</p>
                <p className="text-3xl font-bold text-gray-900 mb-2">{card.value}</p>
                <p className={`text-sm ${getChangeTextColor(card.color)}`}>{card.change}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OverviewCards;
