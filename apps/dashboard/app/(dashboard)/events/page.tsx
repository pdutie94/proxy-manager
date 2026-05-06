'use client';

import React, { useState, useEffect } from 'react';
import { Activity, Clock, Server, Globe, Search, Filter, RefreshCw, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { useToast } from '@/components/Toast';

const EventsPage: React.FC = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const { addToast } = useToast();

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await api.getRecentEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
      addToast({
        type: 'error',
        title: 'Lỗi',
        message: 'Không thể tải danh sách sự kiện'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending': return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'warning': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'CREATE_PROXY': return 'bg-blue-100 text-blue-800';
      case 'DELETE_PROXY': return 'bg-red-100 text-red-800';
      case 'RENEW_PROXY': return 'bg-purple-100 text-purple-800';
      case 'EXPIRED_PROXY': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredEvents = events.filter(e => filterType === 'all' || e.type === filterType);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhật ký sự kiện</h1>
          <p className="text-gray-600">Theo dõi lịch sử hoạt động của hệ thống proxy</p>
        </div>
        <button
          onClick={fetchEvents}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 overflow-x-auto pb-2">
        <button
          onClick={() => setFilterType('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
            filterType === 'all' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          Tất cả
        </button>
        {['CREATE_PROXY', 'DELETE_PROXY', 'RENEW_PROXY', 'EXPIRED_PROXY'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
              filterType === type ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Events List */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredEvents.map((event) => (
              <div key={event.id} className="p-6 hover:bg-gray-50 transition-colors flex items-start space-x-4">
                <div className={`p-2 rounded-lg ${getTypeColor(event.type)}`}>
                  <Activity className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">{event.title}</h3>
                    <span className="text-xs text-gray-500">{event.time}</span>
                  </div>
                  <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Server className="w-4 h-4 mr-1 text-gray-400" />
                      {event.node}
                    </span>
                    <span className="flex items-center">
                      <Globe className="w-4 h-4 mr-1 text-gray-400" />
                      {event.id}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center space-x-2">
                    {getStatusIcon(event.status)}
                    <span className="text-xs font-medium uppercase">{event.status}</span>
                  </div>
                </div>
              </div>
            ))}
            {filteredEvents.length === 0 && (
              <div className="p-12 text-center text-gray-500">
                Không có sự kiện nào được ghi nhận.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsPage;
