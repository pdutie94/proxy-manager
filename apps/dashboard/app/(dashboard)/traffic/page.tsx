'use client';

import React from 'react';
import { BarChart3, ArrowUpRight, ArrowDownLeft, Activity, Calendar, Download } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const TrafficPage: React.FC = () => {
  // Mock data for the chart
  const data = [
    { name: '00:00', in: 400, out: 240 },
    { name: '04:00', in: 300, out: 139 },
    { name: '08:00', in: 200, out: 980 },
    { name: '12:00', in: 278, out: 390 },
    { name: '16:00', in: 189, out: 480 },
    { name: '20:00', in: 239, out: 380 },
    { name: '23:59', in: 349, out: 430 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Giám sát lưu lượng</h1>
          <p className="text-gray-600">Thống kê băng thông Inbound và Outbound</p>
        </div>
        <div className="flex space-x-2">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 bg-white">
            <Calendar className="w-4 h-4 mr-2" />
            Hôm nay
          </button>
          <button className="inline-flex items-center px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800">
            <Download className="w-4 h-4 mr-2" />
            Xuất báo cáo
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-green-600">+12%</span>
          </div>
          <p className="text-sm text-gray-600">Tổng Inbound</p>
          <p className="text-2xl font-bold text-gray-900">1.28 GB</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-red-600">+5.4%</span>
          </div>
          <p className="text-sm text-gray-600">Tổng Outbound</p>
          <p className="text-2xl font-bold text-gray-900">856.4 MB</p>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
              <Activity className="w-6 h-6" />
            </div>
            <span className="text-sm font-medium text-gray-400">0.0%</span>
          </div>
          <p className="text-sm text-gray-600">Peak Connection</p>
          <p className="text-2xl font-bold text-gray-900">142 req/s</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold mb-6">Biểu đồ băng thông theo thời gian</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a855f7" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
              <Tooltip 
                contentStyle={{backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
              />
              <Area type="monotone" dataKey="in" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" name="Inbound (MB)" />
              <Area type="monotone" dataKey="out" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" name="Outbound (MB)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Nodes Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Sử dụng theo Node</h3>
          <BarChart3 className="w-5 h-5 text-gray-400" />
        </div>
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tên Node</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Inbound</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Outbound</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Tổng cộng</th>
              <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase">Hoạt động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {[
              { name: 'Node VN-HCM-01', in: '452.1 MB', out: '312.4 MB', total: '764.5 MB', percent: 85 },
              { name: 'Node SG-AZURE-02', in: '321.5 MB', out: '145.2 MB', total: '466.7 MB', percent: 42 },
              { name: 'Node US-WEST-05', in: '156.4 MB', out: '98.1 MB', total: '254.5 MB', percent: 28 },
            ].map((node, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{node.name}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{node.in}</td>
                <td className="px-6 py-4 text-sm text-gray-600">{node.out}</td>
                <td className="px-6 py-4 text-sm font-semibold text-gray-900">{node.total}</td>
                <td className="px-6 py-4">
                  <div className="w-full bg-gray-200 rounded-full h-2 max-w-[100px]">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${node.percent}%` }}></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TrafficPage;
