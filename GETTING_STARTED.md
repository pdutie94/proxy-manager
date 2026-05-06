# Getting Started - Proxy Manager

Hướng dẫn chạy toàn bộ hệ thống với Dashboard, API, và Agent.

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- npm

## 1. Start Infrastructure (MySQL + Redis)

```bash
docker-compose up -d
```

Kiểm tra các services đã start:
```bash
docker ps
```

## 2. Setup Database

```bash
npm run db:migrate
```

## 3. Install Dependencies (nếu chưa có)

```bash
npm install
```

## 4. Run Development Services

Mở 3 terminal riêng biệt và chạy từng cái:

### Terminal 1: Dashboard (Next.js) - Port 3000
```bash
npm run dev
```

Output:
```
- Local:         http://localhost:3000
- Network:       http://192.168.1.19:3000
```

### Terminal 2: API (NestJS) - Port 3001
```bash
npm run dev:api
```

Output:
```
[Nest] ... LOG [NestApplication] Nest application successfully started
```

### Terminal 3: Agent (Node.js) - Port 3002
```bash
npm run dev:agent
```

Output:
```
Starting Proxy Agent for Node 1
Health server listening on port 3002
```

## 5. Access Website

- **Dashboard**: http://localhost:3000
- **API Health**: http://localhost:3001/api/health
- **Agent Health**: http://localhost:3002/health

## 6. Test API Proxy (Dashboard → API)

```bash
curl http://localhost:3000/api/health
```

Should return the same as:
```bash
curl http://localhost:3001/api/health
```

## Useful Commands

```bash
# View database
npm run db:studio

# Build all packages
npm run build

# Run linting
npm run lint

# Stop Docker services
docker-compose down

# View Docker logs
docker-compose logs -f mysql
docker-compose logs -f redis
```

## Environment Variables

Các files `.env` đã được config:
- `.env` - Default settings
- `.env.local` - Local development (nếu có)

## Ports Summary

| Service | Port | URL |
|---------|------|-----|
| Dashboard | 3000 | http://localhost:3000 |
| API | 3001 | http://localhost:3001 |
| Agent | 3002 | http://localhost:3002 |
| MySQL | 3306 | localhost:3306 |
| Redis | 6379 | localhost:6379 |

## Troubleshooting

### Port already in use
```bash
# Kill process on port
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux:
lsof -ti:3000 | xargs kill -9
```

### Redis connection refused
```bash
# Make sure Redis is running
docker ps | grep redis

# Or start Redis
docker-compose up -d redis
```

### Database connection error
```bash
# Check MySQL is running
docker ps | grep mysql

# Or run migration
npm run db:migrate
```

## Next Steps

1. ✅ Infrastructure (Docker MySQL + Redis)
2. ✅ Database (Prisma migrations)
3. ✅ All services running
4. 📝 Create test data
5. 📝 Test E2E flows

---

For more details, see [task.md](task.md) - Project phase checklist
