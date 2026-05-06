'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, Terminal, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Node } from '@proxy-manager/db';
import { api } from '../lib/api';

interface Initialize3ProxyModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: Node;
  onSuccess?: () => void;
}

interface InitStep {
  name: string;
  command?: string;
  success?: boolean;
  exitCode?: number;
  output?: string;
  error?: string;
  isLoading?: boolean;
}

const Initialize3ProxyModal: React.FC<Initialize3ProxyModalProps> = ({
  isOpen,
  onClose,
  node,
  onSuccess
}) => {
  const [isInitializing, setIsInitializing] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [steps, setSteps] = useState<InitStep[]>([]);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      // Reset state when modal closes
      setIsInitializing(false);
      setCurrentStep('');
      setSteps([]);
      setResult(null);
    }
  }, [isOpen]);

  const handleInitialize = async () => {
    setIsInitializing(true);
    setResult(null);
    setSteps([]);

    try {
      // Start initialization
      const response = await api.initializeNode(node.id);
      
      if (response.initResult?.success) {
        setResult({
          success: true,
          message: response.initResult.message || '3Proxy đã được cài đặt thành công!'
        });
        
        // Show detailed steps if available
        if (response.initResult?.details?.steps) {
          setSteps(response.initResult.details.steps);
        }
        
        onSuccess?.();
      } else {
        setResult({
          success: false,
          message: response.initResult?.message || 'Cài đặt 3Proxy thất bại'
        });
        
        // Show detailed steps if available
        if (response.initResult?.details?.steps) {
          setSteps(response.initResult.details.steps);
        }
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Lỗi kết nối đến server'
      });
    } finally {
      setIsInitializing(false);
      setCurrentStep('');
    }
  };

  const getStepIcon = (step: InitStep) => {
    if (step.isLoading) {
      return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
    }
    
    if (step.success === true) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    
    if (step.success === false) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
    
    return <Terminal className="w-4 h-4 text-gray-400" />;
  };

  const getStepStatus = (step: InitStep) => {
    if (step.isLoading) return 'text-blue-600 font-medium';
    if (step.success === true) return 'text-green-600';
    if (step.success === false) return 'text-red-600';
    return 'text-gray-600';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Download className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-semibold">
              Cài đặt 3Proxy - {node.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {/* Node Info */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-2">Thông tin Node</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">IP Address:</span>
                  <span className="ml-2 font-medium">{node.ipAddress}</span>
                </div>
                <div>
                  <span className="text-gray-600">SSH Port:</span>
                  <span className="ml-2 font-medium">{node.sshPort}</span>
                </div>
                <div>
                  <span className="text-gray-600">Username:</span>
                  <span className="ml-2 font-medium">{node.sshUsername}</span>
                </div>
                <div>
                  <span className="text-gray-600">Region ID:</span>
                  <span className="ml-2 font-medium">{node.regionId}</span>
                </div>
              </div>
            </div>

            {/* Current Status */}
            {isInitializing && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-blue-900 font-medium">
                    Đang cài đặt 3Proxy...
                  </span>
                </div>
                {currentStep && (
                  <p className="text-blue-700 text-sm mt-1">Bước hiện tại: {currentStep}</p>
                )}
              </div>
            )}

            {/* Result */}
            {result && (
              <div className={`rounded-lg p-4 ${
                result.success 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  {result.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600" />
                  )}
                  <span className={`font-medium ${
                    result.success ? 'text-green-900' : 'text-red-900'
                  }`}>
                    {result.success ? 'Cài đặt thành công!' : 'Cài đặt thất bại!'}
                  </span>
                </div>
                <p className={`text-sm mt-1 ${
                  result.success ? 'text-green-700' : 'text-red-700'
                }`}>
                  {result.message}
                </p>
              </div>
            )}

            {/* Steps Details */}
            {steps.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-4">Chi tiết các bước thực hiện</h3>
                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div key={index} className="border-l-2 border-gray-200 pl-4">
                      <div className="flex items-start gap-2">
                        {getStepIcon(step)}
                        <div className="flex-1">
                          <div className={`font-medium ${getStepStatus(step)}`}>
                            {step.name}
                          </div>
                          {step.command && (
                            <code className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded mt-1 block">
                              {step.command}
                            </code>
                          )}
                          {step.output && (
                            <div className="text-sm text-gray-600 mt-1">
                              Output: {step.output}
                            </div>
                          )}
                          {step.error && (
                            <div className="text-sm text-red-600 mt-1">
                              Error: {step.error}
                            </div>
                          )}
                          {step.exitCode !== undefined && (
                            <div className="text-xs text-gray-500 mt-1">
                              Exit Code: {step.exitCode}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            disabled={isInitializing}
          >
            {result ? 'Đóng' : 'Hủy'}
          </button>
          
          {!result && !isInitializing && (
            <button
              onClick={handleInitialize}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Bắt đầu cài đặt
            </button>
          )}
          
          {result?.success && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Hoàn tất
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Initialize3ProxyModal;
