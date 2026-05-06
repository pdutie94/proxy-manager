'use client';

import React, { useState, useEffect } from 'react';
import { X, RefreshCw, CheckCircle, AlertCircle, Loader2, Activity, Server, Shield, Cpu } from 'lucide-react';
import { Node } from '@proxy-manager/db';
import { api } from '../lib/api';

interface CheckNodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: Node;
  onSuccess?: () => void;
}

interface CheckStep {
  name: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  message?: string;
  details?: any;
}

const CheckNodeModal: React.FC<CheckNodeModalProps> = ({
  isOpen,
  onClose,
  node,
  onSuccess
}) => {
  const [steps, setSteps] = useState<CheckStep[]>([
    { name: 'Kết nối SSH', status: 'pending' },
    { name: 'Kiểm tra hệ thống (OS, CPU, RAM)', status: 'pending' },
    { name: 'Kiểm tra 3Proxy & Agent', status: 'pending' },
    { name: 'Kiểm tra khả năng (FD Limits, IPv6)', status: 'pending' },
  ]);
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      handleCheck();
    } else {
      // Reset state when modal closes
      setSteps([
        { name: 'Kết nối SSH', status: 'pending' },
        { name: 'Kiểm tra hệ thống (OS, CPU, RAM)', status: 'pending' },
        { name: 'Kiểm tra 3Proxy & Agent', status: 'pending' },
        { name: 'Kiểm tra khả năng (FD Limits, IPv6)', status: 'pending' },
      ]);
      setIsChecking(false);
      setResult(null);
    }
  }, [isOpen]);

  const handleCheck = async () => {
    if (isChecking) return;
    setIsChecking(true);
    setResult(null);

    try {
      // Update first step to loading
      setSteps(prev => prev.map((s, i) => i === 0 ? { ...s, status: 'loading' } : s));

      const response = await api.checkNode(node.id);
      const testResult = response.testResult;

      // Map backend stages to our steps
      // Note: This is a simulation of step-by-step for better UX as the API returns all at once
      
      const stages = ['connect', 'system', 'agent', 'capability'];
      
      for (let i = 0; i < steps.length; i++) {
        // Small delay for visual effect
        await new Promise(resolve => setTimeout(resolve, 600));
        
        setSteps(prev => prev.map((s, idx) => {
          if (idx === i) {
            // Check if this stage or any previous stage failed in the actual result
            // Since API returns a single "ok" but we want to show where it failed
            // Actually, testResult has details of stages if we modify it, but for now let's use the main result
            const isOk = testResult.ok || (testResult.stage !== stages[i]);
            
            // If the failure happened at this stage
            if (!testResult.ok && testResult.stage === stages[i]) {
              return { ...s, status: 'error', message: testResult.message };
            }
            return { ...s, status: 'success' };
          }
          if (idx === i + 1) {
            // If the current stage failed, don't start the next one
            if (!testResult.ok && testResult.stage === stages[i]) return s;
            return { ...s, status: 'loading' };
          }
          return s;
        }));

        // Stop if current step failed
        if (!testResult.ok && testResult.stage === stages[i]) break;
      }

      setResult({
        success: testResult.ok,
        message: testResult.ok ? 'Node hoạt động bình thường' : `Lỗi: ${testResult.message}`
      });

      if (testResult.ok) {
        onSuccess?.();
      }

    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Lỗi kết nối đến server'
      });
    } finally {
      setIsChecking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-2xl flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              Kiểm tra Node - {node.name}
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
        <div className="p-6 space-y-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    step.status === 'success' ? 'bg-green-100' :
                    step.status === 'error' ? 'bg-red-100' :
                    step.status === 'loading' ? 'bg-blue-100' : 'bg-gray-200'
                  }`}>
                    {step.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                    {step.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                    {step.status === 'loading' && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                    {step.status === 'pending' && <Activity className="w-4 h-4 text-gray-400" />}
                  </div>
                  <div>
                    <p className={`font-medium ${
                      step.status === 'success' ? 'text-green-900' :
                      step.status === 'error' ? 'text-red-900' :
                      step.status === 'loading' ? 'text-blue-900' : 'text-gray-500'
                    }`}>
                      {step.name}
                    </p>
                    {step.message && <p className="text-xs text-red-600 mt-0.5">{step.message}</p>}
                  </div>
                </div>
                {step.status === 'loading' && (
                  <span className="text-xs font-medium text-blue-600 animate-pulse">Đang kiểm tra...</span>
                )}
              </div>
            ))}
          </div>

          {/* Result */}
          {result && (
            <div className={`rounded-lg p-4 flex items-start gap-3 ${
              result.success 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-red-50 border border-red-200'
            }`}>
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div>
                <p className={`font-bold ${result.success ? 'text-green-900' : 'text-red-900'}`}>
                  {result.success ? 'Kiểm tra hoàn tất' : 'Kiểm tra thất bại'}
                </p>
                <p className={`text-sm ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                  {result.message}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors text-sm font-medium"
          >
            Đóng
          </button>
          {result && !result.success && (
            <button
              onClick={handleCheck}
              className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckNodeModal;
