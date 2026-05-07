'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import NodeModal from './NodeModal';
import RegionModal from './RegionModal';
import ConfirmModal from './ConfirmModal';
import CreateProxyModal from './CreateProxyModal';

interface ModalContextType {
  openNodeModal: (editingNode?: any, onSubmit?: (data: any) => Promise<void>) => void;
  closeNodeModal: () => void;
  openRegionModal: (editingRegion?: any, onSubmit?: (data: any) => Promise<void>) => void;
  closeRegionModal: () => void;
  openConfirmModal: (props: Omit<ConfirmModalProps, 'isOpen' | 'onClose'>) => void;
  closeConfirmModal: () => void;
  openCreateProxyModal: (onSubmit: (data: any) => Promise<void>) => void;
  closeCreateProxyModal: () => void;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  loading?: boolean;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const useModal = () => {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider');
  }
  return context;
};

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [nodeModalState, setNodeModalState] = useState({
    isOpen: false,
    editingNode: null as any,
    onSubmit: null as ((data: any) => Promise<void>) | null,
  });

  const [regionModalState, setRegionModalState] = useState({
    isOpen: false,
    editingRegion: null as any,
    onSubmit: null as ((data: any) => Promise<void>) | null,
  });

  const [confirmModalState, setConfirmModalState] = useState<ConfirmModalProps>({
    isOpen: false,
    onClose: () => {},
    onConfirm: () => {},
    title: '',
    message: '',
    confirmText: 'Xóa',
    cancelText: 'Hủy',
    loading: false,
  });

  const [createProxyModalState, setCreateProxyModalState] = useState({
    isOpen: false,
    onSubmit: null as ((data: any) => Promise<void>) | null,
  });

  const openNodeModal = useCallback((editingNode?: any, onSubmit?: (data: any) => Promise<void>) => {
    setNodeModalState({
      isOpen: true,
      editingNode: editingNode || null,
      onSubmit: onSubmit || null,
    });
  }, []);

  const closeNodeModal = useCallback(() => {
    setNodeModalState({
      isOpen: false,
      editingNode: null,
      onSubmit: null,
    });
  }, []);

  const openRegionModal = useCallback((editingRegion?: any, onSubmit?: (data: any) => Promise<void>) => {
    setRegionModalState({
      isOpen: true,
      editingRegion: editingRegion || null,
      onSubmit: onSubmit || null,
    });
  }, []);

  const closeRegionModal = useCallback(() => {
    setRegionModalState({
      isOpen: false,
      editingRegion: null,
      onSubmit: null,
    });
  }, []);

  const openConfirmModal = useCallback((props: Omit<ConfirmModalProps, 'isOpen' | 'onClose'>) => {
    setConfirmModalState({
      isOpen: true,
      onClose: () => setConfirmModalState(prev => ({ ...prev, isOpen: false })),
      onConfirm: props.onConfirm,
      title: props.title,
      message: props.message,
      confirmText: props.confirmText,
      cancelText: props.cancelText,
      loading: props.loading,
    });
  }, []);

  const closeConfirmModal = useCallback(() => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const openCreateProxyModal = useCallback((onSubmit: (data: any) => Promise<void>) => {
    setCreateProxyModalState({
      isOpen: true,
      onSubmit,
    });
  }, []);

  const closeCreateProxyModal = useCallback(() => {
    setCreateProxyModalState({
      isOpen: false,
      onSubmit: null,
    });
  }, []);

  return (
    <ModalContext.Provider
      value={{
        openNodeModal,
        closeNodeModal,
        openRegionModal,
        closeRegionModal,
        openConfirmModal,
        closeConfirmModal,
        openCreateProxyModal,
        closeCreateProxyModal,
      }}
    >
      {children}
      
      {/* Modals rendered outside of layout */}
      <>
        {/* Node Modal */}
        <NodeModal
          isOpen={nodeModalState.isOpen}
          onClose={closeNodeModal}
          onSubmit={nodeModalState.onSubmit || (async () => {})}
          editingNode={nodeModalState.editingNode}
        />

        {/* Region Modal */}
        <RegionModal
          isOpen={regionModalState.isOpen}
          onClose={closeRegionModal}
          onSubmit={regionModalState.onSubmit || (async () => {})}
          editingRegion={regionModalState.editingRegion}
        />

        {/* Confirm Modal */}
        <ConfirmModal
          isOpen={confirmModalState.isOpen}
          onClose={confirmModalState.onClose}
          onConfirm={confirmModalState.onConfirm}
          title={confirmModalState.title}
          message={confirmModalState.message}
          confirmText={confirmModalState.confirmText}
          cancelText={confirmModalState.cancelText}
          loading={confirmModalState.loading}
        />

        {/* Create Proxy Modal */}
        <CreateProxyModal
          isOpen={createProxyModalState.isOpen}
          onClose={closeCreateProxyModal}
          onSubmit={createProxyModalState.onSubmit || (async () => {})}
        />
      </>
    </ModalContext.Provider>
  );
};
