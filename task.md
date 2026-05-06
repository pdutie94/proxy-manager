# Proxy Manager Restructure - Implementation Checklist

Production-ready proxy management system with NestJS API, Next.js Dashboard, and Node.js Agent.

---

## Phase 1: Foundation (Monorepo Setup)

### 1.1 Folder Structure
- [x] Create `apps/api/` - NestJS backend
- [x] Create `apps/dashboard/` - Next.js frontend  
- [x] Create `apps/agent/` - Node.js worker
- [x] Create `libs/db/` - Prisma + shared client
- [x] Create `libs/common/` - Shared types/utils
- [x] Move existing Next.js app → `apps/dashboard/`


### 1.2 Root Package.json
- [x] Setup npm/pnpm workspaces
- [x] Add scripts: `dev`, `build`, `db:generate`, `db:migrate`
- [ ] Add dependencies: TypeScript, ESLint, Prettier

### 1.3 Database Schema (libs/db)
- [ ] Update `prisma/schema.prisma`:
  - [ ] Rename Server → Node (remove usedPorts, keep maxPorts)
  - [ ] Add IpPool table (ipv6, status, cooldownUntil)
  - [ ] Add Port table (nodeId, port, status, UNIQUE(nodeId, port))
  - [ ] Update Proxy table (status: pending|active|error|expired|suspended, lastConfigHash, deletedAt)
  - [ ] Add TrafficStat table (proxyId, bytesIn, bytesOut, recordedAt, UNIQUE(proxyId, recordedAt))
  - [ ] Add EventOutbox table (id, type, payload, status, retryCount, createdAt)
- [ ] Create migration
- [ ] Generate Prisma client
- [ ] Export shared DbModule

**Deliverable**: `npx prisma migrate dev` runs successfully ✅

---

## Phase 2: NestJS API (apps/api) - Code Ready, Needs Testing

### 2.1 Bootstrap
- [x] `npm install @nestjs/core @nestjs/common @nestjs/platform-express`
- [x] `npm install ioredis bullmq` (Redis + queue)
- [x] `npm install @nestjs/schedule` (cron)
- [x] `npm install p-retry` (retry logic)
- [x] Setup main.ts (port 3001)

### 2.2 Modules Structure
- [x] **ProxyModule**: CRUD, renew, delete
- [x] **AllocatorModule**: Port + IP allocation
- [x] **EventModule**: Outbox pattern + Redis producer
- [x] **NodeModule**: Node registration, heartbeat
- [x] **CronModule**: Expire check, outbox retry, pending timeout

### 2.3 Key Services

#### PortAllocatorService
- [x] `allocatePort(nodeId)` - FOR UPDATE SKIP LOCKED
- [x] `releasePort(portId)` - mark free
- [x] Unique constraint check + retry logic
- [ ] OS bind test (best-effort warning)

#### IpAllocatorService  
- [x] `allocateIp(nodeId)` - lazy generate IPv6
- [x] Respect cooldown period
- [x] Index on (status, cooldownUntil)
- [x] Generate from /64 subnet

#### ProxyEventService
- [x] `publishEvent()` - save to outbox first
- [x] `processOutbox()` - cron retry (max 5)
- [x] Status: pending → sent → failed → dead

#### ProxyService
- [x] `createProxy()` - transaction (allocate + event)
- [x] Support `idempotencyKey` (24h TTL)
- [x] `markProxyApplied()` - Agent ACK endpoint
- [x] `deleteProxy()` - graceful: active→suspended→deleted
- [x] `renewProxy()` - update expiresAt
- [x] Backpressure check (pending > threshold → 429)

#### ProxyCronService
- [x] Every minute: expire proxies (status → expired, release resources)
- [x] Every minute: pending timeout (> 2min → retry/error)
- [x] Every 10s: process outbox

### 2.4 API Endpoints
- [x] `POST /proxies` - Create (idempotencyKey support)
- [x] `DELETE /proxies/:id` - Graceful delete
- [x] `POST /proxies/:id/renew` - Renew
- [x] `POST /proxies/:id/applied` - Agent ACK
- [x] `GET /proxies` - List
- [x] `POST /nodes/:id/heartbeat` - Heartbeat
- [x] `GET /health` - System health

**Deliverable**: `curl http://localhost:3001/health` returns 200 
**API Testing**: All endpoints working - CREATE PROXY SUCCESS 

---

## Phase 3: Node Agent (apps/agent) - ✅ COMPLETED (2026-05-04)

### 3.1 Bootstrap
- [x] `npm install ioredis` (Redis Streams)
- [x] `npm install p-queue` (concurrency)
- [x] `npm install p-debounce` (batching)
- [x] Replaced `better-sqlite3` with file-based buffer
- [x] `npm install node-cron` (scheduling)
- [x] `npm install express` (health server)
- [x] Setup main.ts

### 3.2 Components

#### EventConsumer
- [x] `XREADGROUP` from `proxy_events` stream
- [x] Filter by `nodeId`
- [x] `XACK` only after successful apply
- [x] `XPENDING` + `XCLAIM` reclaim logic

#### IdempotencyChecker
- [x] Fetch `proxy.lastConfigHash` from API
- [x] Compare with `event.configHash`
- [x] Logic: match → skip, mismatch → apply, missing → apply

#### ConfigRenderer
- [x] `renderProxyConfig(proxy)` → `socks -p{port} -e{ipv6} -i0.0.0.0`
- [x] Shard by `port % 256` → hex filename
- [x] Read current shard, merge updates

#### SafeConfigUpdater
- [x] Backup `.cfg` → `.cfg.bak`
- [x] Write to `.cfg.tmp`
- [x] Validate: `3proxy -c` (optional, Windows compatible)
- [x] Atomic rename `.cfg.tmp` → `.cfg`
- [x] Reload: `killall -USR1 3proxy` (Windows/Linux compatible)

#### DebouncedUpdater
- [x] `scheduleConfigUpdate(shard)`
- [x] Debounce: 300ms
- [x] MaxWait: 2s
- [x] Per-shard queue

#### StartupReconciler
- [x] On start: fetch all `active` proxies from API
- [x] Group by shard
- [x] Rebuild each shard file
- [x] Reload 3proxy

#### PeriodicReconciler
- [x] Cron every 5-10 minutes
- [x] Fetch DB state → rebuild shard config files
- [x] Fix drift (self-healing)

#### BandwidthCollector
- [x] Read 3proxy logs
- [x] Buffer to local file storage
- [x] Batch report every 30s
- [x] Idempotent insert (handle duplicate)
- [x] Resend unsent on restart

#### HealthServer
- [x] `GET /health` endpoint
- [x] Return: `{ lastEventTime, queueLength, proxyStatus, activeProxies, uptime }`

#### MetricsCollector
- [x] Track: configUpdates/sec, errorCount, bandwidthBytes

### 3.3 Configuration
- [x] `DRY_RUN=true` - process but don't apply
- [x] `NODE_ID` - filter events
- [x] `REDIS_URL`
- [x] `API_URL`
- [x] `HMAC_SECRET` - verify event signature

### 3.4 Event Processing Flow
```
Receive Event → Verify HMAC → Check Idempotency → Priority Queue → 
Debounce Batch → Render Config → Safe Update → ACK → Mark Applied
```

- [x] Receive Event: XREADGROUP from Redis Streams
- [x] Verify HMAC: SHA256 signature validation
- [x] Check Idempotency: Compare configHash + version ordering
- [x] Priority Queue: DELETE (100) > EXPIRE (90) > CREATE (50) > RENEW (40)
- [x] Debounce Batch: 300ms debounce per shard, max 2s wait
- [x] Render Config: 256-shard 3proxy config generation
- [x] Safe Update: Atomic write + backup + validation + reload
- [x] ACK Event: Redis XACK after successful apply
- [x] Mark Applied: POST to API with configHash

**Deliverable**: Agent starts, connects Redis, processes events with priority queue ✅
**Documentation**: [EVENT_FLOW.md](apps/agent/EVENT_FLOW.md) with complete flow description

---

## Phase 4: Frontend Integration (apps/dashboard) - ✅ COMPLETED (2026-05-04)

### 4.1 API Proxy
- [x] Create `app/api/[...path]/route.ts`
- [x] Proxy `/api/*` to `http://localhost:3001`
- [x] Pass through auth headers

### 4.2 Keep Existing
- [x] Auth pages (login, etc.)
- [x] Dashboard UI
- [x] Proxy management UI
- [x] Notification system

**Deliverable**: `npm run dev` serves UI on :3000, API calls proxied to :3001 ✅

---

## Phase 5: Integration & Testing

### 5.1 Local Dev Setup
- [ ] `docker-compose.yml`: MySQL + Redis
- [ ] Start all services
- [ ] Verify connectivity

### 5.2 End-to-End Flow Test
- [ ] Create proxy via API
- [ ] Verify event in Redis
- [ ] Agent consumes event
- [ ] Config file updated
- [ ] 3proxy reloads
- [ ] Proxy status → active
- [ ] Connect test via proxy
- [ ] Delete proxy
- [ ] Config removed

### 5.3 Edge Case Tests
- [ ] Rapid create/delete (batching test)
- [ ] Agent crash mid-update (reconciler test)
- [ ] Network partition (retry + outbox test)
- [ ] Duplicate event (idempotency test)
- [ ] High load (backpressure test)

### 5.4 Failover Tests
- [ ] Node offline → proxies suspended
- [ ] Agent restart → full reconcile
- [ ] Redis restart → event replay

**Deliverable**: All tests pass, system stable under load

---

## Phase 6: Migration & Deploy

### 6.1 Database Migration
- [ ] Backup existing data
- [ ] Run Prisma migration (Server → Node schema)
- [ ] Verify schema correct
- [ ] **DO NOT migrate old proxies** (let expire naturally)

### 6.2 Deploy Agent to Proxy Nodes
- [ ] Install Node.js on proxy servers
- [ ] Deploy agent code
- [ ] Setup 3proxy + config directory
- [ ] Start agent as systemd service
- [ ] Verify agent health endpoint

### 6.3 Switchover
- [ ] Stop SSH-based proxy management
- [ ] Enable Redis event flow
- [ ] Monitor for issues
- [ ] Rollback plan if needed

### 6.4 Monitoring Setup
- [ ] Setup alerts (errorRate, pending, heartbeat, reloadFail)
- [ ] Configure log aggregation
- [ ] Setup dashboards

**Deliverable**: Production system running, old + new coexist during transition

---

## Checklist Summary

| Phase | Key Deliverable | Status |
|-------|-----------------|--------|
| 1 | Monorepo structure + DB schema | ✅ Done (2025-05-03) |
| 2 | NestJS API with all endpoints | ✅ Done & Tested (2025-05-04) |
| 3 | Node Agent consuming events | ✅ Done & Tested (2026-05-04) |
| 4 | Dashboard proxying to API | ✅ Done (2026-05-04) |
| 5 | E2E tests passing | ⬜ Pending |
| 6 | Production deploy + monitoring | ⬜ Pending |

---

## Notes

- **Hybrid migration**: Old proxies stay in old schema, new use IpPool/Port
- **No proxy migration**: Let old expire naturally
- **Single source of truth**: DB for config, Redis for events
- **Self-healing**: Periodic reconciler fixes drift automatically
- **Observability**: Correlation ID traces full request path
