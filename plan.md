# Proxy Manager Admin Panel - Implementation Plan

## 1. Overview

Hệ thống quản lý proxy cho phép:
- **Admin**: Quản lý servers, khách hàng, tạo/cài đặt proxy qua SSH
- **Khách hàng**: Xem danh sách proxy được assign

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Backend API | Next.js API Routes + TypeScript |
| Database | MySQL (Prisma ORM) |
| Authentication | JWT (Access + Refresh tokens) |
| SSH Client | `node-ssh` (Node.js) |
| Styling | TailwindCSS |
| State Management | Zustand |

## 3. Architecture (Single Application - Same Domain)

```
proxy-manager/
|-- app/
|   |-- api/                    # Next.js API routes
|   |   |-- auth/               # Authentication endpoints
|   |   |-- admin/              # Admin endpoints
|   |   |-- customer/           # Customer endpoints
|   |-- (auth)/
|   |   |-- login/              # Login page
|   |-- (dashboard)/
|   |   |-- admin/              # Admin dashboard
|   |   |-- customer/           # Customer dashboard
|   |-- globals.css
|   |-- layout.tsx
|   |-- page.tsx
|-- lib/
|   |-- auth.ts                # Authentication utilities
|   |-- db.ts                  # Prisma client
|   |-- utils.ts               # Utility functions
|-- prisma/
|   |-- schema.prisma           # Database schema
|   |-- migrations/             # Database migrations
|   |-- seed.ts                # Seed data
|-- components/
|   |-- ui/                    # Reusable components
|   |-- auth/                  # Auth components
|   |-- layout/                # Layout components
|-- package.json               # Single package.json
|-- .env.local                 # Environment variables
```

**Deployment Strategy**: 
- Single Next.js application running on port 3000
- API routes served from same application at `/api/*`
- No need for reverse proxy or multiple servers
- Simplified deployment to any Node.js host

## 4. Database Schema (MySQL + Prisma)

```prisma
// prisma/schema.prisma

model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  password  String    // bcrypt hashed
  name      String
  role      Role      @default(CUSTOMER) // ADMIN | CUSTOMER
  isActive  Boolean   @default(true)
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  // Relations
  proxies   Proxy[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        Int       @id @default(autoincrement())
  token     String    @unique
  userId    Int
  expiresAt DateTime
  createdAt DateTime  @default(now())
  
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Server {
  id          Int       @id @default(autoincrement())
  name        String    // Tên hiển thị
  host        String    // IP hoặc domain
  sshPort     Int       @default(22)
  sshUsername String
  sshPassword String?   // Có thể null nếu dùng private key
  sshPrivateKey String? @db.Text
  
  // 3proxy config
  proxyPortStart  Int   @default(10000)
  proxyPortEnd    Int   @default(20000)
  
  status      ServerStatus @default(PENDING) // PENDING | ACTIVE | ERROR | OFFLINE
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // Relations
  proxies     Proxy[]
  
  @@index([status])
}

model Proxy {
  id          Int       @id @default(autoincrement())
  serverId    Int
  
  // Proxy info
  port        Int
  username    String?   // Nếu có auth
  password    String?   // Nếu có auth
  protocol    Protocol  @default(SOCKS5) // HTTP | SOCKS4 | SOCKS5
  
  // Assignment
  assignedTo  Int?      // User ID
  expiresAt   DateTime? // Ngày hết hạn
  
  // Status
  isActive    Boolean   @default(true)
  lastChecked DateTime?
  
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  
  // Relations
  server      Server    @relation(fields: [serverId], references: [id], onDelete: Cascade)
  customer    User?     @relation(fields: [assignedTo], references: [id], onDelete: SetNull)
  
  @@unique([serverId, port])
  @@index([assignedTo])
  @@index([isActive])
}

enum Role {
  ADMIN
  CUSTOMER
}

enum ServerStatus {
  PENDING      // Mới thêm, chưa cài đặt
  INSTALLING   // Đang chạy script cài đặt
  ACTIVE       // Hoạt động
  ERROR        // Lỗi
  OFFLINE      // Không kết nối được
}

enum Protocol {
  HTTP
  SOCKS4
  SOCKS5
}
```

## 5. API Endpoints (Next.js API Routes)

### Authentication
```
POST   /api/auth/login           # Login, return access + refresh tokens
POST   /api/auth/refresh         # Refresh access token
POST   /api/auth/logout          # Revoke refresh token
GET    /api/auth/me              # Get current user
```

### Admin - Users Management
```
GET    /api/admin/users          # List all customers
GET    /api/admin/users/[id]     # Get customer detail
POST   /api/admin/users          # Create customer
PUT    /api/admin/users/[id]     # Update customer
DELETE /api/admin/users/[id]     # Delete customer
```

### Admin - Servers Management
```
GET    /api/admin/servers              # List all servers
GET    /api/admin/servers/[id]         # Get server detail
POST   /api/admin/servers              # Add new server
PUT    /api/admin/servers/[id]         # Update server info
DELETE /api/admin/servers/[id]         # Remove server

POST   /api/admin/servers/[id]/install  # Run install script via SSH
POST   /api/admin/servers/[id]/check    # Check server connection

# Proxy management on server
GET    /api/admin/servers/[id]/proxies          # List proxies on server
POST   /api/admin/servers/[id]/proxies          # Create proxy on server
DELETE /api/admin/servers/[id]/proxies/[port]   # Remove proxy
POST   /api/admin/servers/[id]/proxies/assign    # Assign proxy to customer
```

### Customer
```
GET    /api/customer/proxies     # List my assigned proxies
GET    /api/customer/proxies/[id]/details  # Get proxy connection info
```

## 6. Frontend Structure (Next.js Single App)

```
app/
|-- (auth)/
|   |-- login/
|   |   |-- page.tsx            # Login page
|   |-- layout.tsx              # Auth layout (no sidebar)
|
|-- (dashboard)/
|   |-- layout.tsx              # Dashboard layout dengan sidebar
|   |-- page.tsx                # Dashboard home (role-based redirect)
|   |
|   |-- admin/
|   |   |-- users/
|   |   |   |-- page.tsx        # List customers
|   |   |   |-- [id]/
|   |   |       |-- page.tsx     # Customer detail
|   |   |
|   |   |-- servers/
|   |       |-- page.tsx        # List servers
|   |       |-- create/
|   |       |   |-- page.tsx     # Add new server
|   |       |-- [id]/
|   |           |-- page.tsx     # Server detail
|   |           |-- install/
|   |           |   |-- page.tsx # Install 3proxy
|   |           |-- proxies/
|   |               |-- page.tsx # Manage proxies
|   |
|   |-- customer/
|       |-- proxies/
|           |-- page.tsx        # My proxies list
|
|-- api/                        # Next.js API routes
|   |-- auth/
|   |   |-- login/route.ts
|   |   |-- refresh/route.ts
|   |   |-- logout/route.ts
|   |   |-- me/route.ts
|   |-- admin/
|   |   |-- users/route.ts
|   |   |-- servers/route.ts
|   |-- customer/
|       |-- proxies/route.ts
|
|-- globals.css
|-- layout.tsx                  # Root layout
|-- page.tsx                    # Home page (redirect to login)

components/
|-- ui/                         # Reusable components
|-- auth/                       # Login form, etc
|-- layout/                     # Sidebar, header, navigation
|-- admin/
|   |-- users/
|   |-- servers/
|-- customer/

lib/
|-- auth.ts                     # Authentication utilities
|-- db.ts                       # Prisma client
|-- utils.ts                    # Utility functions
|-- api.ts                      # API client (axios/fetch)

hooks/                          # Custom React hooks
stores/                         # Zustand stores
types/                          # TypeScript types
```

## 7. Key Features Implementation

### 7.1 SSH Service (Next.js Utility)

```typescript
// lib/ssh.ts
import { NodeSSH } from 'node-ssh';

export class SshService {
  async connect(server: any): Promise<NodeSSH> {
    const ssh = new NodeSSH();
    await ssh.connect({
      host: server.host,
      port: server.sshPort,
      username: server.sshUsername,
      password: server.sshPassword,
      privateKey: server.sshPrivateKey,
    });
    return ssh;
  }

  async install3Proxy(server: any): Promise<void> {
    const ssh = await this.connect(server);
    try {
      // Script cài 3proxy
      const installScript = `
        apt-get update
        apt-get install -y build-essential git
        cd /tmp
        git clone https://github.com/z3APA3A/3proxy.git
        cd 3proxy
        make -f Makefile.Linux
        make -f Makefile.Linux install
        mkdir -p /etc/3proxy
        echo "daemon" > /etc/3proxy/3proxy.cfg
        echo "maxconn 1000" >> /etc/3proxy/3proxy.cfg
      `;
      
      await ssh.execCommand(installScript);
    } finally {
      ssh.dispose();
    }
  }

  async createProxy(server: any, proxy: any): Promise<void> {
    const ssh = await this.connect(server);
    try {
      // Thêm proxy vào config
      const authConfig = proxy.username 
        ? `users ${proxy.username}:CL:${proxy.password}`
        : '';
      
      const proxyLine = proxy.protocol === 'SOCKS5'
        ? `socks -p${proxy.port} ${proxy.username ? '-a' : ''}`
        : `proxy -p${proxy.port} ${proxy.username ? '-a' : ''}`;

      const script = `
        echo "${authConfig}" >> /etc/3proxy/3proxy.cfg
        echo "${proxyLine}" >> /etc/3proxy/3proxy.cfg
        killall 3proxy || true
        3proxy /etc/3proxy/3proxy.cfg
      `;
      
      await ssh.execCommand(script);
    } finally {
      ssh.dispose();
    }
  }
}
```

### 7.2 Auth Flow

1. **Login**: Client gửi email/password → Server trả về `accessToken` (15 phút) + `refreshToken` (7 ngày)
2. **Storage**: Access token lưu memory (Zustand), Refresh token lưu httpOnly cookie
3. **Auto refresh**: Axios interceptor tự động refresh khi 401
4. **Role guard**: Middleware check role, redirect nếu không đủ quyền

### 7.3 Server Installation Flow

```
1. Admin nhập thông tin server (IP, SSH credentials)
2. Save vào DB với status = PENDING
3. Admin click "Install" → Backend SSH vào server
4. Backend chạy script cài đặt 3proxy
5. Update status = ACTIVE nếu thành công, ERROR nếu fail
6. Admin có thể tạo proxy trên server đã cài
```

## 8. Local Development

### Environment
- **OS**: Windows (Laragon)
- **Database**: MySQL 8.0 (user: root, no password)
- **Database URL**: `mysql://root:@localhost:3306/proxy_manager`
- **Application**: Next.js (port 3000) - Single app with API routes

### Development Commands
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run database migrations
npm run db:studio    # Open Prisma Studio
```

### URLs
- Application: http://localhost:3000
- API Routes: http://localhost:3000/api/*
- Prisma Studio: http://localhost:5555

### Development Plan
Xem file `tasks.md` cho các steps implement chi tiêt tiap phase.

---

## 9. Security Considerations

- [ ] Bcrypt for password hashing (rounds: 12)
- [ ] JWT secret từ environment variable
- [ ] Rate limiting (login attempts)
- [ ] Input validation (class-validator)
- [ ] SQL injection protection (Prisma ORM)
- [ ] XSS protection (Next.js built-in)
- [ ] SSH keys preferred over passwords

---

## 10. Future Enhancements

- [ ] Auto-renewal proxy subscription
- [ ] Payment integration (Stripe/PayPal)
- [ ] Proxy rotation/refresh
- [ ] API key for customer programmatic access
- [ ] Analytics (proxy usage stats)
- [ ] Bulk proxy creation
- [ ] Server monitoring (CPU, RAM, bandwidth)

---

**Triển khai**: Xem `tasks.md` cho checklist chi tiết.
