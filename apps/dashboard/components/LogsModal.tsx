'use client';

import React from 'react';
import { X, Terminal, RefreshCw, Copy, Download } from 'lucide-react';

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  logs: string;
  loading?: boolean;
  onRefresh?: () => void;
}

const LogsModal: React.FC<LogsModalProps> = ({
  isOpen,
  onClose,
  title,
  logs,
  loading = false,
  onRefresh
}) => {
  if (!isOpen) return null;

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logs);
    // You could add a toast here if you have access to it
  };

  const handleDownloadLogs = () => {
    const element = document.createElement('a');
    const file = new Blob([logs], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `node-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full flex flex-col h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Terminal className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-500">Xem nhật ký hoạt động của 3Proxy</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={handleCopyLogs}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Copy to clipboard"
            >
              <Copy className="w-5 h-5" />
            </button>
            <button
              onClick={handleDownloadLogs}
              className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
              title="Download logs"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-sm">
          {loading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <div className="flex flex-col items-center space-y-4">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span>Đang tải nhật ký...</span>
              </div>
            </div>
          ) : logs ? (
            <pre className="text-green-400 whitespace-pre-wrap break-all">
              {logs}
            </pre>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-500">
              Không có dữ liệu nhật ký.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center flex-shrink-0">
          <div className="text-xs text-gray-500">
            Hiển thị 100 dòng nhật ký gần nhất
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default LogsModal;
