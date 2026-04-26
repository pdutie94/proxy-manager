'use client';

import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import {
  Check,
  CheckCheck,
  Info,
  AlertTriangle,
  Clock,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  Bell
} from 'lucide-react';

interface Notification {
  id: string;
  type: 'SYSTEM' | 'PROXY_EXPIRING_SOON' | 'PROXY_EXPIRED' | 'PROXY_RENEWED' | 'ADMIN_MESSAGE';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  data?: any;
}

const NOTIFICATION_ICONS = {
  SYSTEM: Info,
  PROXY_EXPIRING_SOON: Clock,
  PROXY_EXPIRED: AlertTriangle,
  PROXY_RENEWED: Check,
  ADMIN_MESSAGE: MessageSquare,
};

const NOTIFICATION_COLORS = {
  SYSTEM: 'text-blue-500 bg-blue-50 border-blue-200',
  PROXY_EXPIRING_SOON: 'text-amber-500 bg-amber-50 border-amber-200',
  PROXY_EXPIRED: 'text-red-500 bg-red-50 border-red-200',
  PROXY_RENEWED: 'text-green-500 bg-green-50 border-green-200',
  ADMIN_MESSAGE: 'text-purple-500 bg-purple-50 border-purple-200',
};

export default function NotificationsPage() {
  const { success, error: toastError } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchNotifications();
  }, [pagination.page, filter]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await api.get<{
        notifications: Notification[];
        pagination: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
        unreadCount: number;
      }>(`/api/customer/notifications?page=${pagination.page}&limit=${pagination.limit}&filter=${filter}`);

      setNotifications(response.notifications);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toastError('Không thể tải thông báo');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await api.patch(`/api/customer/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toastError('Không thể đánh dấu đã đọc');
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.post('/api/customer/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      success('Đã đánh dấu tất cả thông báo là đã đọc');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toastError('Không thể đánh dấu tất cả đã đọc');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Thông báo</h1>
          <p className="mt-2 text-gray-600">
            Xem tất cả thông báo từ hệ thống và admin
          </p>
        </div>
        <button
          onClick={markAllAsRead}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
        >
          <CheckCheck className="h-4 w-4" />
          Đánh dấu tất cả đã đọc
        </button>
      </div>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => {
            setFilter('all');
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
        >
          Tất cả
        </button>
        <button
          onClick={() => {
            setFilter('unread');
            setPagination((prev) => ({ ...prev, page: 1 }));
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            filter === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
          }`}
        >
          Chưa đọc
        </button>
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900">
              {filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
            </h3>
            <p className="mt-1 text-gray-500">
              {filter === 'unread'
                ? 'Bạn đã đọc tất cả thông báo'
                : 'Thông báo mới sẽ xuất hiện ở đây'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {notifications.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.type];
              const colorClass = NOTIFICATION_COLORS[notification.type];

              return (
                <div
                  key={notification.id}
                  className={`p-6 hover:bg-gray-50 transition-colors ${
                    notification.isRead ? '' : 'bg-blue-50/50'
                  }`}
                >
                  <div className="flex gap-4">
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center border ${colorClass}`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            {notification.title}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!notification.isRead && (
                            <>
                              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                              <button
                                onClick={() => markAsRead(notification.id)}
                                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-50 rounded"
                              >
                                Đánh dấu đã đọc
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 mt-2">{notification.message}</p>

                      {/* Additional data display */}
                      {notification.data && notification.data.proxyId && (
                        <div className="mt-3 text-xs text-gray-500">
                          Proxy Port: {notification.data.port || 'N/A'}
                          {notification.data.expiresAt && (
                            <span className="ml-2">
                              | Hết hạn: {new Date(notification.data.expiresAt).toLocaleDateString('vi-VN')}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && notifications.length > 0 && pagination.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-700">
              Hiển thị {(pagination.page - 1) * pagination.limit + 1} -{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} /{' '}
              {pagination.total} thông báo
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page - 1 }))
                }
                disabled={pagination.page === 1}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </button>
              <button
                onClick={() =>
                  setPagination((prev) => ({ ...prev, page: prev.page + 1 }))
                }
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
