'use client';

import React from 'react';
import { Server } from 'lucide-react';

interface NodeData {
  id: string;
  name: string;
  proxyCount: number;
  utilization: number;
  status: 'online' | 'offline' | 'warning';
}

interface NodeStatusPanelProps {
  nodes: NodeData[];
}

const NodeStatusPanel: React.FC<NodeStatusPanelProps> = ({ nodes }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500';
      case 'offline':
        return 'bg-gray-400';
      case 'warning':
        return 'bg-orange-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getProgressBarColor = (utilization: number) => {
    if (utilization >= 70) return 'bg-orange-500';
    if (utilization > 0) return 'bg-green-500';
    return 'bg-gray-300';
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between border-b border-gray-100 pb-3">
        <h3 className="text-lg font-semibold text-gray-900">Trạng thái Nodes</h3>
        <a href="#" className="text-sm text-blue-600 hover:text-blue-800">
          Xem tất cả
        </a>
      </div>

      <div className="space-y-0">
        {nodes.map((node, index) => (
          <div key={`${node.id}-${index}`} className={`flex items-center py-3 ${index < nodes.length - 1 ? 'border-b border-gray-100' : ''}`}>
            <div className={`w-2 h-2 rounded-full ${getStatusColor(node.status)} mr-4`}></div>
            <span className="text-sm font-medium text-gray-900 flex-grow">{node.name}</span>
            <span className="text-sm text-gray-600 w-[120px] text-right">{node.proxyCount} proxy</span>
            <span className="text-sm text-gray-600 w-[60px] text-right">{node.utilization}%</span>
            <div className="w-[150px] bg-gray-200 rounded-full h-1.5 ml-6">
              <div
                className={`${getProgressBarColor(node.utilization)} h-1.5 rounded-full transition-all duration-300`}
                style={{ width: `${node.utilization}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NodeStatusPanel;
