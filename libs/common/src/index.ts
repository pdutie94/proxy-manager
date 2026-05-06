// Event Types
export enum ProxyEventType {
  PROXY_CREATE = 'PROXY_CREATE',
  PROXY_DELETE = 'PROXY_DELETE',
  PROXY_EXPIRE = 'PROXY_EXPIRE',
  PROXY_RENEW = 'PROXY_RENEW',
  PROXY_APPLIED = 'PROXY_APPLIED',
  NODE_SUSPEND = 'NODE_SUSPEND',
  NODE_RESUME = 'NODE_RESUME',
}

// Event Payload
export interface ProxyEvent {
  id: string;
  type: ProxyEventType;
  nodeId: number;
  proxyId: number;
  ipv6?: string;
  port?: number;
  username?: string;
  password?: string;
  expiresAt?: string;
  timestamp: string;
  version: number;
  configHash: string;
  correlationId: string;
  signature?: string;
}

// Node Selection Weights
export const NODE_WEIGHTS = {
  AVAILABLE_PORTS: 1.0,
  HEALTH_SCORE: 0.0, // Future: implement health score
  CPU_USAGE: 0.0,    // Future: implement CPU weight
};

// Proxy Status
export const PROXY_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  ERROR: 'error',
  EXPIRED: 'expired',
  SUSPENDED: 'suspended',
} as const;

// Config Constants
export const CONFIG = {
  PORT_RANGE_START: 10000,
  PORT_RANGE_END: 60000,
  SHARD_COUNT: 256,
  IPV6_COOLDOWN_MINUTES: 30,
  DEBOUNCE_MS: 300,
  MAX_WAIT_MS: 2000,
  PENDING_TIMEOUT_MINUTES: 2,
  MAX_RELOAD_PER_SECOND: 2,
  TRAFFIC_BATCH_SECONDS: 30,
  EVENT_MAX_RETRY: 5,
  IDEMPOTENCY_KEY_TTL_HOURS: 24,
  RECONCILE_INTERVAL_MINUTES: 10,
  HEARTBEAT_TIMEOUT_SECONDS: 30,
  BACKPRESSURE_THRESHOLD: 1000,
  MAX_CONN_PER_PROXY: 64,
} as const;

// Utility functions
export function getShardIndex(port: number): string {
  const index = port % CONFIG.SHARD_COUNT;
  return index.toString(16).padStart(2, '0');
}

export function generateConfigHash(data: Record<string, unknown>): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').slice(0, 16);
}

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
