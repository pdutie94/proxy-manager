import React from 'react';
import './globals.css';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@/components/Toast';
import { ModalProvider } from '@/components/ModalContainer';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Proxy Manager',
  description: 'Proxy Management Dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <ToastProvider>
          <ModalProvider>
            {children}
          </ModalProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
