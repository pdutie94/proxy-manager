# Proxy Manager Restructure Plan

Convert the existing Next.js app into a monorepo with NestJS API, Next.js Dashboard, and Node.js Agent using Redis Streams for event-driven proxy management.

---

## 1. Folder Structure

```
e:\Nodejs\proxy-manager/
├── apps/
│   ├── api/                    # NestJS backend (port 3001)
│   │   ├── src/
│   │   │   ├── proxy/
│   │   │   ├── allocator/
│   │   │   ├── event/
│   │   │   ├── node/
│   │   │   └── cron/
│   │   └── package.json
│   ├── dashboard/              # Next.js frontend (port 3000)
│   │   ├── app/
│   │   │   ├── (dashboard)/
│   │   │   └── api/            # Proxy /api/* to NestJS
│   │   └── package.json
│   └── agent/                  # Node.js worker (no NestJS)
│       ├── src/
│       │   ├── config/
│       │   ├── events/
│       │   └── 3proxy/
│       └── package.json
├── libs/
│   ├── db/                     # Prisma + shared client
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   └── src/
│   └── common/                 # Shared types, utils
│       └── src/
└── package.json                # Root workspace config
```

---

## 2. Database Schema Changes

### Rename Server → Node
- Add `maxPorts` to Node
- **Remove `usedPorts`** → query `SELECT COUNT(*) FROM Port WHERE nodeId = ? AND status = 'used'`
- Add `lastSeen` from NodeHeartbeat
- **Why no usedPorts**: Avoid drift, single source of truth

### New Tables
- **IpPool**: IPv6 addresses with status (free/in_use/cooling/banned)
- **Port**: Port numbers per node with status
- **NodeHeartbeat**: Node health tracking (already exists)

### Proxy Table Updates
- Replace `serverId` with `nodeId`
- Add `ipPoolId`, `portId` (foreign keys)
- **Status field**: `status: pending | active | error | expired | suspended`
  - `pending`: Created, waiting Agent ACK
  - `active`: Agent applied config successfully
  - `error`: Apply failed or timeout
  - Flow: API creates → `pending` → Agent applies → POST `/proxies/:id/applied` → `active`
- **lastConfigHash**: Store applied config hash in DB (DB = truth, Redis = cache)
- **deletedAt**: Soft delete (optional but recommended for debugging)
### TrafficStat Table (separate from Proxy)
- Track bandwidth in dedicated table to avoid row locking
- Fields: `proxyId`, `bytesIn`, `bytesOut`, `recordedAt`
- Index on `[proxyId, recordedAt]`

### Auto-Generation Triggers
- On Node create: Pre-generate port range (10000-60000)
- IPv6: **Lazy generation** - generate on demand during allocation

### Resource Release (Critical)
When proxy deleted/expired:
- `port.status = free` (immediately reusable)
- `ip.status = cooling` (not immediately reusable)
- `ip.cooldownUntil = now + X minutes` (e.g., 30 min)
- Without this → system runs out of IPs quickly
- Cooldown prevents rapid reuse, reduces abuse risk

### IPv6 Pool Optimization
- **Index**: `(status, cooldownUntil)` for fast lookup
- **Batch generate**: Optional /64 block pre-generation to reduce fragmentation

### Node Status (Global Kill Switch)
- `node.status = active | suspended | offline`
- When `suspended`: Agent stops applying configs, disables all proxies
- Critical for: abuse reports, maintenance, emergency shutdown

---

## 3. NestJS API (apps/api)

### Modules
- **ProxyModule**: CRUD, list, renew, delete
- **AllocatorModule**: Transaction-safe port + IP allocation
- **EventModule**: Redis Streams producer
  - **Outbox Pattern**: Events saved to `event_outbox` table first
  - **Reliable delivery**: Cron job retries failed publishes to Redis
  - **Why**: Prevent DB commit ok but Redis publish fail → Agent miss event
- **NodeModule**: Node registration, heartbeat
- **CronModule**: Expired proxy cleanup

### Key Services
- `PortAllocatorService`: Atomic port reservation
  - **Core**: `UNIQUE(nodeId, port)` constraint = source of truth
  - **Flow**: `SELECT ... FOR UPDATE SKIP LOCKED` → `UPDATE` → if unique fail → retry
  - **OS check**: Best-effort warning only, NOT core logic (race in multi-process)
- `IpAllocatorService`: IPv6 with cooldown logic (lazy generation + reuse)
- `ProxyEventService`: Publish to Redis Streams
- `ProxyCronService`: Every minute expire check

### API Endpoints
```
POST   /proxies              # Create proxy (auto-allocate, support idempotencyKey)
DELETE /proxies/:id          # Delete proxy (graceful: active→suspended→deleted)
POST   /proxies/:id/renew    # Renew proxy
POST   /proxies/:id/applied  # Agent ACK after config applied
GET    /proxies              # List proxies
POST   /nodes/:id/heartbeat  # Node heartbeat

### API Idempotency Key (Critical for Scale + Billing)
- **Problem**: Network retry → duplicate proxy creation
- **Solution**: Client sends `idempotencyKey` (UUID), API stores → returns existing if duplicate
- **TTL**: Key expires after 24h
- **Critical for**: Billing accuracy, prevent user spam
```

### Create Proxy Logic
- **Node selection**: Calculate `weight = available_ports - active_proxies`. Pick highest weight node. Accept explicit `nodeId` if provided.
- **Allocation flow**: Transaction → Lock port+IP → Mark used → Publish event
- **MVP acceptable**: Port-based weight. Future: health score, load balancing, geo routing.

---

## 4. Redis Event System

### Stream: `proxy_events`

### Event Types
```typescript
enum ProxyEventType {
  PROXY_CREATE = 'PROXY_CREATE',
  PROXY_DELETE = 'PROXY_DELETE',
  PROXY_EXPIRE = 'PROXY_EXPIRE',
  PROXY_RENEW  = 'PROXY_RENEW',
}
```

### Event Payload (Two Modes)
```typescript
// Small scale - full payload
interface ProxyEventFull {
  id: string;
  type: ProxyEventType;
  nodeId: number;
  proxyId: number;
  ipv6: string;
  port: number;
  username: string;
  password: string;
  expiresAt: string;
  timestamp: string;
  version: number;
  configHash: string;
  correlationId: string;  // For tracing
}

// Large scale - ID only (Agent fetches from API)
interface ProxyEventLite {
  id: string;
  type: ProxyEventType;
  nodeId: number;
  proxyId: number;
  version: number;
  configHash: string;
  correlationId: string;
}
```

### Observability (Structured Logging)
- **Correlation ID**: Trace request across API → Redis → Agent → Config
- **Fields**: `eventId`, `proxyId`, `action`, `status`, `duration`, `nodeId`
- **Structured format**: JSON logs for easy parsing
- **Log flow**: Every step logs with same correlation ID for full traceability

### Event Ordering (Critical for Out-of-Order)
- Add `version` field (auto-increment on each proxy update)
- Agent only applies if `event.version >= proxy.currentVersion`
- **Type priority**: `DELETE` always applies regardless of version (highest priority)
- **State-based fallback**: If suspicious mismatch, agent fetches current state from API/DB
- Prevents: DELETE arriving before CREATE → proxy "comes back to life"

### Event + DB Consistency (Outbox Pattern)
- **Problem**: DB commit OK, but Redis publish fail → Agent never receives event
- **Solution**: Save events to `event_outbox` table, async worker publishes to Redis
- **Status**: `pending` → `sent` → `failed` → `dead`
- **Retry**: Max 5 attempts, then move to `dead` queue
- **MVP**: Cron job scanning every 10s with retry counter

### Redis Consumer Group Strategy
- **ACK flow**: `XREADGROUP` → process → apply config OK → `XACK`
- **Reclaim**: `XPENDING` + `XCLAIM` to reclaim "stuck" messages when agent dies
- **Never ACK early**: Only ACK after successful config apply

---

## 5. Node Agent (apps/agent)

### Architecture
- No NestJS framework (lightweight)
- Redis Streams consumer (XREADGROUP)
- Event filter by `nodeId`

### Components
- **ConfigRenderer**: Generate 3proxy config files
- **SafeConfigUpdater**: Atomic file updates + SIGUSR1 (with rollback on failure)
- **EventConsumer**: Redis Streams consumer group
- **BandwidthCollector**: Read logs → buffer locally (sqlite) → batch report every 30s
  - **Idempotent insert**: `UNIQUE(proxyId, recordedAt)` or `INSERT ... ON DUPLICATE KEY UPDATE`
  - **Crash safety**: Unsent data in sqlite, resend on restart, dedupe by unique key
- **IdempotencyChecker**: Compare `event.configHash` with `proxy.lastConfigHash` (from DB). Logic: match → skip, mismatch → apply + update DB. Redis as cache only, DB is source of truth.
- **StartupReconciler**: On agent start, fetch all active proxies → group by shard (port % 256) → rebuild each shard file individually → controlled full rebuild
- **PeriodicReconciler**: Run every 5-10 minutes → fetch DB state → compare with current config → fix drift (self-healing loop)
- **DebouncedUpdater**: Batch per shard with `debounce: 300ms` + `maxWait: 2s`. Fast flush for small batches, force flush for burst load.
- **HealthServer**: HTTP endpoint `GET /health` → returns `{ lastEventTime, queueLength, proxyStatus, activeProxies, uptime }`
- **MetricsCollector**: Track `configUpdates/sec`, `errorCount`, `bandwidthBytes`

### Alerting Rules (Production Critical)
- **errorRate > 5%** → Alert (system unstable)
- **pendingProxies > threshold** → Alert (Agent falling behind)
- **agentHeartbeat > 30s** → Alert (Agent dead/unreachable)
- **configReloadFail** → Alert (3proxy issue)
- **DryRunMode**: `DRY_RUN=true` env var → process events but don't apply configs (debug/testing)
- **RateLimiter** (optional): `maxconn per proxy` → prevent abuse, avoid Hetzner warnings
- **Audit Log**: Track who created/deleted proxy, when (for compliance/debugging)
- **Create Rate Limit**: `max proxies / user / minute` → prevent user spam
- **HMAC Signature**: Event `signature = HMAC(payload, SECRET)`, Agent verifies before apply (prevent fake events)
- **Config Version Snapshot**: Agent stores `currentConfigVersion` for debugging mismatches
- **Bulk Operations**: API support for create/delete 100+ proxies efficiently
- **Priority Queue**: `DELETE > CREATE > RENEW` (not all events equal)

### Multi-Agent Per Node (Future-Safe)
- **Risk**: Running multiple agents on same node → config conflict
- **Future solution**: 
  - Option A: DB/Redis lock per node
  - Option B: Leader election (only 1 active agent)
- **Current**: Document as single-agent-per-node assumption

### Config Sharding
- Files: `/etc/3proxy/conf.d/00.cfg` to `ff.cfg` (256 shards)
- **Sharding**: `port % 256` → hex filename (optimal for 3proxy operations)
- Format: `socks -p{port} -e{ipv6} -i0.0.0.0`
- **Scale limit**: Max ~1000-2000 proxies per shard. If exceeded → increase to 512 or 1024 shards

### Safe Update Flow (with Rollback)
1. Backup current config to `.cfg.bak`
2. Write new config to `.cfg.tmp`
3. Validate syntax (`3proxy -c`)
4. Atomic rename `.tmp` → `.cfg`
5. Reload: `kill -USR1 $(cat /var/run/3proxy.pid)`
6. **If reload fails**: Restore from `.cfg.bak` → reload again → alert

### Crash Recovery (Critical Edge Case)
- **Edge case**: Agent crashes between "rename done" and "reload done"
- **Result**: Config file ≠ runtime state
- **Fix**: StartupReconciler = ultimate truth fixer → on start, verify/rebuild all configs

### Pending Proxy Timeout (Critical)
- **Problem**: If Agent doesn't ACK, proxy stuck in `pending` forever
- **Fix**: Cron job every minute: IF `pending > 2 minutes` → retry event OR mark `error`

### Graceful Delete Flow
- **Flow**: `active` → `suspended` (disable immediately) → `deleted` (cleanup after grace period)
- **Why**: Avoid sudden connection drop, easier debugging, user has time to react
- **Grace period**: 5 minutes between suspended → deleted

### Global System Backpressure
- **Problem**: 10k create requests → Agent chokes
- **Solution**: API layer check `pending_proxies > threshold` → reject (429) or queue
- **Threshold**: Configurable (e.g., 1000 pending)

### Node Offline Handling
- **Option A (simple)**: When `node.status = offline` → mark all proxies `suspended`
- **Option B (advanced)**: Trigger re-allocation to other nodes

### Config Reload Rate Limiting
- **Global limit**: `maxReloadPerSecond = 2` (prevent CPU spike, 3proxy choke)
- Combined with debounce + batch for burst protection

### Concurrency & Batching
- Use `p-queue` (limit: 1 concurrent config update per shard)
- **Debounced updates**: `scheduleConfigUpdate(shard)` delays 300-500ms, groups multiple events into single update
- Prevents 100 events → 100 reloads (CPU spike)

---

## 6. Next.js Dashboard (apps/dashboard)

### Changes
- Move existing app → apps/dashboard
- Add `/api/*` route handlers → proxy to NestJS
- Remove old API routes (migrate to NestJS)
- Keep UI components, auth, notifications

### API Proxy
```typescript
// app/api/[...path]/route.ts
// Proxy all /api/* to NestJS at localhost:3001
```

---

## 7. Shared Libraries (libs/)

### libs/db
- Prisma schema
- PrismaClient singleton
- Migration scripts

### libs/common
- Event types/interfaces
- Utility functions
- Constants (port ranges, IPv6 prefix)

---

## 8. Implementation Steps

### Phase 1: Foundation
1. Setup monorepo workspace (npm/pnpm workspaces)
2. Create folder structure
3. Move existing Next.js → apps/dashboard
4. Setup libs/db with new Prisma schema

### Phase 2: NestJS API
1. Bootstrap NestJS app
2. Implement AllocatorModule (Port + IP)
3. Implement ProxyModule (CRUD)
4. Implement EventModule (Redis producer)
5. Add cron job for proxy expiration

### Phase 3: Node Agent
1. Create lightweight Node.js worker
2. Implement Redis Streams consumer
3. Implement ConfigRenderer
4. Implement SafeConfigUpdater
5. Add 3proxy SIGUSR1 integration

### Phase 4: Integration
1. Wire up dashboard → NestJS proxy
2. Test full flow: Create → Apply → Expire
3. Add bandwidth tracking
4. Test multi-node scenario

### Phase 5: Migration (CRITICAL - No Proxy Migration)
1. Create database migration (Server → Node) - **Schema only**
2. **DO NOT migrate existing proxies** - Let old model proxies expire naturally
3. New system proxies use IpPool + Port model
4. Deploy agent to proxy servers
5. Switch from SSH to Redis events

⚠️ **Why no proxy migration?**
- Old proxy model ≠ New proxy model
- Risk: Port conflicts, IP conflicts, lost config
- Safe approach: Run both systems, old expires naturally

---

## 9. Key Design Decisions

### Transaction Safety
- Use Prisma transactions for port + IP allocation
- Lock row during allocation to prevent double-assign

### Redis Streams vs Pub/Sub
- Streams: Persistent, consumer groups, replay capability
- Best for production event bus

### Config File Sharding
- Prevents single large file
- Faster updates (only touch one shard)
- Better 3proxy reload performance

### Agent Concurrency
- Queue prevents concurrent config writes
- Single-threaded config updates eliminate race conditions

---

## 10. Files to Generate

1. Root `package.json` with workspaces
2. `libs/db/prisma/schema.prisma` (updated)
3. `apps/api/src/proxy/` - CRUD services
4. `apps/api/src/allocator/` - Port/IP allocators
5. `apps/api/src/event/` - Redis producer
6. `apps/api/src/cron/` - Expiration job
7. `apps/agent/src/` - Full agent implementation
8. `apps/dashboard/app/api/[...path]/route.ts` - API proxy
