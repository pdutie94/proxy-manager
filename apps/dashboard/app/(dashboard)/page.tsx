'use client';

import React, { useState, useEffect } from 'react';
import OverviewCards from '@/components/OverviewCards';
import NodeStatusPanel from '@/components/NodeStatusPanel';
import SystemStatusPanel from '@/components/SystemStatusPanel';
import RecentEventsPanel from '@/components/RecentEventsPanel';
import AlertPanel from '@/components/AlertPanel';
import { api } from '@/lib/api';

interface OverviewData {
  activeProxies: number;
  activeProxiesChange: number;
  pendingApplication: number;
  pendingApplicationPercentage: number;
  onlineNodes: number;
  totalNodes: number;
  onlineNodesPercentage: number;
  redisQueue: number;
  lastUpdated: string;
  systemActive: boolean;
}

interface NodeData {
  id: string;
  name: string;
  proxyCount: number;
  utilization: number;
  status: 'online' | 'offline' | 'warning';
}

interface SystemStatusData {
  name: string;
  status: 'active' | 'connected' | 'pending' | 'running';
  description: string;
  value?: number;
}

interface EventData {
  id: string;
  type: 'CREATE_PROXY' | 'DELETE_PROXY' | 'RENEW_PROXY' | 'EXPIRED_PROXY';
  title: string;
  node: string;
  time: string;
  status: 'applied' | 'pending' | 'warning';
  timestamp: string;
}

interface AlertData {
  id: string;
  type: 'warning' | 'error' | 'info';
  title: string;
  message: string;
  time: string;
  timestamp: string;
}

export default function Dashboard() {
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [nodesData, setNodesData] = useState<NodeData[]>([]);
  const [systemStatusData, setSystemStatusData] = useState<SystemStatusData[]>([]);
  const [eventsData, setEventsData] = useState<EventData[]>([]);
  const [alertsData, setAlertsData] = useState<AlertData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard data from API
    const fetchDashboardData = async () => {
      try {
        // Use the API client to fetch data
        const [overview, nodes, systemStatus, events, alerts] = await Promise.all([
          api.getDashboardOverview(),
          api.getNodesStatus(),
          api.getSystemStatus(),
          api.getRecentEvents(),
          api.getAlerts()
        ]);

        setOverviewData(overview);
        setNodesData(nodes);
        setSystemStatusData(systemStatus);
        setEventsData(events);
        setAlertsData(alerts);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Don't use mock data - let the user see the error
        setOverviewData(null);
        setNodesData([]);
        setSystemStatusData([]);
        setEventsData([]);
        setAlertsData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
    
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
          {/* Overview Section */}
          <div className="mb-8">
            {overviewData && <OverviewCards data={overviewData} />}
          </div>

          {/* Middle Section - Node Status and System Status */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8 items-stretch">
            <div className="lg:col-span-7 h-full">
              <NodeStatusPanel nodes={nodesData} />
            </div>
            <div className="lg:col-span-5 h-full">
              <SystemStatusPanel systemStatus={systemStatusData} />
            </div>
          </div>

          {/* Bottom Section - Recent Events and Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentEventsPanel events={eventsData} />
            <AlertPanel alerts={alertsData} />
          </div>
    </div>
  );
}
