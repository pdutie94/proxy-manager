# Phase 5: Integration & Testing - Complete Setup Guide

## Overview

Phase 5 completes the Proxy Manager restructure with comprehensive testing, integration verification, and production readiness checks.

## 🚀 Quick Start

### 1. Setup Development Environment

```bash
# Clone and setup
git clone <repository>
cd proxy-manager

# Run automated setup
npm run setup

# Or manual setup:
# 1. Copy environment file
cp .env.example .env

# 2. Start services
npm run docker:up

# 3. Install dependencies
npm install

# 4. Setup database
npm run db:migrate
npm run db:generate
```

### 2. Start All Services

```bash
# Start all services in parallel
npm run dev:all

# Or start individually:
npm run dev:api      # API on port 3001
npm run dev          # Dashboard on port 3000
npm run dev:agent    # Agent on port 3002
```

### 3. Verify Services

```bash
# Check all services connectivity
npm run verify

# Expected output:
# ✅ MySQL: Database connected and operational
# ✅ Redis: Redis responding to PING
# ✅ API: API responding
# ✅ Dashboard: Dashboard responding (status: 200)
# ⚠️ Agent: Port 3002 not accessible (agent may not be running)
```

## 🧪 Testing Suite

### Run All Tests

```bash
# Complete test suite (E2E + Edge Cases + Failover)
npm run test

# Quick tests only (E2E + Edge Cases, skip Failover)
npm run test:quick
```

### Individual Test Suites

```bash
# End-to-End Flow Tests
npm run test:e2e

# Edge Cases Tests
npm run test:edge

# Failover Tests
npm run test:failover
```

### Test Coverage

#### E2E Tests ✅
- API health check
- Proxy creation flow
- Redis event publishing
- Agent event consumption
- Config file generation
- Proxy activation
- Proxy deletion

#### Edge Cases Tests ✅
- Rapid create/delete (10 proxies in 2 seconds)
- Idempotency (duplicate requests)
- Concurrent port allocation
- Event ordering
- Backpressure (pending proxy limits)
- Invalid node ID handling
- Expired proxy creation

#### Failover Tests ✅
- Node offline simulation
- Redis restart recovery
- Agent health recovery
- Database connection recovery
- Resource exhaustion
- Concurrent user operations
- Graceful shutdown

## 📊 Test Results Interpretation

### Success Indicators
```
🎉 ALL TESTS PASSED! System is ready for production.
```

### Warning Indicators
```
⚠️ Some tests had issues (may be expected in test environment)
```

### Common Issues & Solutions

#### Agent Not Running
```
❌ Agent not reachable
```
**Solution**: Agent is optional for testing. Start with `npm run dev:agent`

#### Port Conflicts
```
❌ Port 3001 not accessible
```
**Solution**: Check for port conflicts:
```bash
netstat -an | grep :3001
# Kill conflicting processes or change ports in .env
```

#### Database Issues
```
❌ Database connection issues detected
```
**Solution**: Reset database:
```bash
npm run db:reset
```

## 🔧 Development Workflow

### Daily Development
```bash
# Start services
npm run docker:up
npm run dev:all

# Run quick tests
npm run test:quick

# Verify services
npm run verify
```

### Before Commit
```bash
# Run full test suite
npm run test

# Check linting
npm run lint

# Verify all services
npm run verify
```

### Production Deployment
```bash
# Build all applications
npm run build

# Run comprehensive tests
npm run test

# Verify production readiness
npm run verify
```

## 📁 File Structure

```
scripts/
├── dev-setup.sh          # Automated development setup
├── verify-services.js    # Services connectivity checker
├── test-e2e.js          # End-to-end tests
├── test-edge-cases.js   # Edge cases tests
├── test-failover.js     # Failover tests
└── run-all-tests.js     # Comprehensive test runner

.env.example             # Environment template
docker-compose.yml       # Local services (MySQL + Redis)
```

## 🔍 Service Health Monitoring

### Health Endpoints

- **API**: `http://localhost:3001/health`
- **Dashboard**: `http://localhost:3000`
- **Agent**: `http://localhost:3002/health`

### Health Check Script
```bash
# Detailed health check
npm run verify

# Check specific service
curl http://localhost:3001/health
curl http://localhost:3002/health
```

## 🚨 Troubleshooting

### Common Issues

#### Services Not Starting
```bash
# Check Docker
docker --version
docker-compose ps

# Restart services
npm run docker:down
npm run docker:up
```

#### Database Migration Issues
```bash
# Reset database
npm run db:reset

# Manual migration
cd libs/db
npx prisma migrate dev
```

#### Test Failures
```bash
# Check logs
npm run docker:logs

# Run individual test to debug
npm run test:e2e
npm run test:edge
npm run test:failover
```

#### Port Conflicts
```bash
# Find conflicting processes
lsof -i :3000
lsof -i :3001
lsof -i :3002

# Kill processes
kill -9 <PID>
```

## 📈 Performance Testing

### Load Testing
```bash
# Create 100 proxies rapidly
node -e "
const axios = require('axios');
const promises = [];
for (let i = 0; i < 100; i++) {
  promises.push(axios.post('http://localhost:3001/proxies', {
    nodeId: 1,
    userId: 1,
    expiresAt: new Date(Date.now() + 24*60*60*1000).toISOString(),
    protocol: 'SOCKS5',
    idempotencyKey: \`load-test-\${i}-\${Date.now()}\`
  }));
}
Promise.all(promises).then(() => console.log('Load test completed'));
"
```

### Stress Testing
```bash
# Run edge cases with high load
npm run test:edge

# Monitor system resources
docker stats
```

## ✅ Phase 5 Completion Checklist

- [x] Docker-compose.yml for local dev (MySQL + Redis)
- [x] Environment configuration (.env.example)
- [x] Development setup script (dev-setup.sh)
- [x] Services connectivity verification (verify-services.js)
- [x] End-to-end test suite (test-e2e.js)
- [x] Edge cases test suite (test-edge-cases.js)
- [x] Failover test suite (test-failover.js)
- [x] Comprehensive test runner (run-all-tests.js)
- [x] Package.json scripts for all operations
- [x] Documentation and troubleshooting guide

## 🎯 Next Steps

### Phase 6: Migration & Deploy
1. Database migration (Server → Node schema)
2. Deploy agent to proxy nodes
3. Switchover from SSH to Redis events
4. Setup monitoring and alerting
5. Production deployment

### Production Readiness
- All tests passing ✅
- Services verified ✅
- Documentation complete ✅
- Monitoring setup required ⬜
- Deployment scripts required ⬜

---

**Phase 5 Status: ✅ COMPLETE**

The Proxy Manager system is now fully integrated and tested. All core functionality is working and the system is ready for production deployment after Phase 6 completion.
