'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { Send, Users, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '@/components/ui/ConfirmModal';

interface Customer {
  id: number;
  name: string;
  email: string;
  isActive: boolean;
  role: string;
}

interface NotificationRecipient {
  type: 'all' | 'specific';
  count: number;
  users: Customer[];
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  recipients: NotificationRecipient;
}

export default function AdminNotificationsPage() {
  const { success, error: toastError } = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [sentNotifications, setSentNotifications] = useState<Notification[]>([]);
  const [notificationsPage, setNotificationsPage] = useState(1);
  const [notificationsTotal, setNotificationsTotal] = useState(0);

  useEffect(() => {
    fetchCustomers();
    fetchSentNotifications();
  }, [notificationsPage]);

  const fetchCustomers = async () => {
    try {
      setCustomersLoading(true);
      const response = await api.get<{ users: Customer[] }>('/api/admin/users');
      console.log('API Response:', response);
      setCustomers(response.users); // API already returns only CUSTOMER role
    } catch (error) {
      console.error('Failed to fetch customers:', error);
    } finally {
      setCustomersLoading(false);
    }
  };

  const fetchSentNotifications = async () => {
    try {
      const response = await api.get<{
        notifications: Notification[];
        pagination: { total: number };
      }>(`/api/admin/notifications?page=${notificationsPage}&limit=10`);
      setSentNotifications(response.notifications);
      setNotificationsTotal(response.pagination.total);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toastError('Vui lòng nhập tiêu đề và nội dung');
      return;
    }

    if (target === 'specific' && selectedUsers.length === 0) {
      toastError('Vui lòng chọn ít nhất một khách hàng');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/admin/notifications', {
        target,
        userIds: target === 'specific' ? selectedUsers : undefined,
        title: title.trim(),
        message: message.trim(),
      });

      success(`Đã gửi thông báo đến ${target === 'all' ? 'tất cả khách hàng' : selectedUsers.length + ' khách hàng'}`);
      
      // Reset form
      setTitle('');
      setMessage('');
      setSelectedUsers([]);
      
      // Refresh sent notifications
      fetchSentNotifications();
    } catch (error) {
      console.error('Failed to send notification:', error);
      toastError('Không thể gửi thông báo');
    } finally {
      setLoading(false);
    }
  };

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(customerSearch.toLowerCase())
  );

  console.log(customers)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Gửi thông báo</h1>
        <p className="mt-2 text-gray-600">
          Gửi thông báo đến khách hàng từ hệ thống
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Send Form */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Send className="h-5 w-5 text-blue-600" />
            Tạo thông báo mới
          </h2>

          {/* Target selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Gửi đến
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="all"
                  checked={target === 'all'}
                  onChange={() => setTarget('all')}
                  className="mr-2"
                />
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Tất cả khách hàng
                </span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="specific"
                  checked={target === 'specific'}
                  onChange={() => setTarget('specific')}
                  className="mr-2"
                />
                <span>Chọn khách hàng cụ thể</span>
              </label>
            </div>
          </div>

          {/* User selection */}
          {target === 'specific' && (
            <div className="mb-6" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn khách hàng ({selectedUsers.length} đã chọn)
              </label>
              
              {/* Selected users tags */}
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedUsers.map((userId) => {
                    const customer = customers.find((c) => c.id === userId);
                    return customer ? (
                      <span
                        key={userId}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                      >
                        {customer.name}
                        <button
                          onClick={() => toggleUserSelection(userId)}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {/* Search input with dropdown */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm kiếm khách hàng..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                
                {/* Dropdown list - show all customers when search is empty */}
                {isDropdownOpen && !customersLoading && (
                  <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {filteredCustomers.map((customer) => (
                      <label
                        key={customer.id}
                        className="flex items-center p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(customer.id)}
                          onChange={() => toggleUserSelection(customer.id)}
                          className="mr-3"
                        />
                        <div>
                          <p className="font-medium text-sm">{customer.name}</p>
                          <p className="text-xs text-gray-500">{customer.email}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                
                {isDropdownOpen && customersLoading && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                    Đang tải danh sách khách hàng...
                  </div>
                )}
                
                {isDropdownOpen && !customersLoading && filteredCustomers.length === 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 text-center text-gray-500 text-sm">
                    Không tìm thấy khách hàng
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Title */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tiêu đề
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tiêu đề thông báo"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nội dung
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Nhập nội dung thông báo"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleSend}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Đang gửi...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Gửi thông báo
              </>
            )}
          </button>
        </div>

        {/* Sent History */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-green-600" />
            Lịch sử gửi
          </h2>

          <div className="max-h-[500px] overflow-y-auto">
            {sentNotifications.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                Chưa có thông báo nào được gửi
              </p>
            ) : (
              <div className="space-y-3">
                {sentNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm text-gray-900">
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDate(notification.createdAt)}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full">
                        {notification.type === 'ADMIN_MESSAGE'
                          ? 'Admin'
                          : notification.type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      {notification.message}
                    </p>
                    {notification.recipients && (
                      <p className="text-xs text-gray-500 mt-1">
                        Đến: {notification.recipients.type === 'all' 
                          ? `Tất cả khách hàng (${notification.recipients.count} người)` 
                          : `${notification.recipients.count} khách hàng: ${notification.recipients.users.map(u => u.name).slice(0, 3).join(', ')}${notification.recipients.count > 3 ? '...' : ''}`
                        }
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {sentNotifications.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                Trang {notificationsPage} / {Math.ceil(notificationsTotal / 10)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setNotificationsPage((p) => p - 1)}
                  disabled={notificationsPage === 1}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setNotificationsPage((p) => p + 1)}
                  disabled={notificationsPage >= Math.ceil(notificationsTotal / 10)}
                  className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
