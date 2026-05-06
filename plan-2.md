# Proxy Manager Hardening & Optimization Plan (Phase 2)

This plan outlines the critical remaining tasks to bring the Proxy Manager platform to production-ready status, focusing on automation, reliability, and observability.

---

## 1. Automation & Resource Management

### [x] Automatic Port Generation
- **Context**: Currently, ports must be manually added or initialized.
- **Task**: When a Node is created via `NodesController`, automatically trigger a background job to populate the `Port` table.
- **Logic**: Generate ports from `proxyPortStart` to `proxyPortEnd` (default 10000-20000).
- **Files**: `apps/api/src/node/node.service.ts`

### [x] Dynamic IPv6 Pool Scaling
- **Context**: Large nodes might need millions of IPv6 addresses.
- **Task**: Implement "Lazy Generation" for IPv6. Instead of pre-populating millions of rows, generate new rows in `IpPool` in batches (e.g., 1000 at a time) when the free pool drops below a threshold.
- **Files**: `apps/api/src/allocator/ip-pool.service.ts`

---

## 2. Reliability & Safety

### [x] Idempotency for Proxy Creation
- **Context**: Network retries can lead to duplicate proxies and resource waste.
- **Task**: Support `idempotencyKey` in the `POST /proxies` endpoint. Store keys in Redis or DB for 24 hours.
- **Files**: `apps/api/src/proxy/proxy.controller.ts`

### [x] Event Outbox Background Worker
- **Context**: `EventService` currently tries to publish to Redis immediately. If Redis is down, the event might be lost.
- **Task**: Implement a dedicated NestJS Cron job to scan `event_outbox` for `PENDING` or `FAILED` events and retry them.
- **Files**: `apps/api/src/cron/outbox-worker.service.ts`

### [x] Event Signature Verification (Agent-side)
- **Context**: Prevent unauthorized event execution on nodes.
- **Task**: Enable HMAC verification in the Agent. The API signs the payload, and the Agent verifies it using a shared `HMAC_SECRET`.
- **Files**: `apps/agent/src/events/consumer.ts`

---

## 3. Observability & Monitoring

### [x] Bandwidth Log Integration (3Proxy)
- **Context**: `BandwidthCollector` exists but needs a feed.
- **Task**: Update the `ConfigRenderer` in the Agent to configure 3Proxy logging to a specific CSV format: `log /var/log/3proxy/bandwidth.log "L${p.proxyId},%I,%O,%t"`.
- **Files**: `apps/agent/src/config/renderer.ts`

### [REMOVED] Real-time Status via WebSockets
- **Context**: The dashboard requires manual refreshes to see node status.
- **Task**: Implement a NestJS Gateway (Socket.io). When a node sends a heartbeat or a check completes, broadcast the status change to connected dashboard clients.
- **Status**: Removed per user request.

---

## 4. Operational Excellence

### [x] Global Node Kill Switch
- **Context**: Emergency shutdown for abused or compromised nodes.
- **Task**: When `node.status` is set to `SUSPENDED`, the API must emit a special `NODE_SUSPEND` event. The Agent must then disable all proxy configurations on that node immediately.
- **Files**: `apps/api/src/nodes/nodes.controller.ts`, `apps/agent/src/events/consumer.ts`

### [x] Graceful Deletion & Cooldown
- **Context**: Rapidly reusing IPs/Ports can lead to site bans.
- **Task**: Implement a 5-minute "cooling" state for IPv6 addresses after a proxy is deleted.
- **Files**: `apps/api/src/allocator/allocator.service.ts`

---

## 5. Implementation Roadmap

1.  **Foundation**: Auto-port generation + Outbox worker.
2.  **Safety**: Idempotency + HMAC verification.
3.  **Data**: 3Proxy logging + Bandwidth flushing.
4.  **UX**: WebSockets for real-time dashboard updates.
5.  **Scaling**: IPv6 lazy generation.
