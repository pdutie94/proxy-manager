'use client';

import { useAuthStore } from '@/stores/authStore';
import { useEffect, useState } from 'react';

export function useAuthCheck() {
  const { user, isAuthenticated } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      // Check if we have tokens in localStorage
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');
      const userData = localStorage.getItem('auth-storage');

      if (!accessToken || !refreshToken || !userData) {
        // No tokens found, redirect to login
        window.location.href = '/login';
        return;
      }

      try {
        // Parse user data from storage
        const parsedData = JSON.parse(userData);
        const { state } = parsedData;
        
        if (!state.isAuthenticated || !state.user) {
          // Invalid auth state, redirect to login
          window.location.href = '/login';
          return;
        }

        // Auth is valid, stop checking
        setIsChecking(false);
      } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = '/login';
      }
    };

    // Small delay to ensure store is hydrated
    const timer = setTimeout(checkAuth, 100);
    
    return () => clearTimeout(timer);
  }, []); // Remove dependencies to prevent infinite loop

  return { isChecking };
}
