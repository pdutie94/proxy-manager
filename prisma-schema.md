generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum NodeStatus {
  online
  offline
}

enum ProxyStatus {
  active
  expired
  suspended
}

enum IpStatus {
  free
  in_use
  cooling
  banned
}

enum PortStatus {
  free
  used
}

model Node {
  id         Int         @id @default(autoincrement())
  name       String
  ipAddress  String
  region     String
  status     NodeStatus  @default(offline)

  maxPorts   Int         @default(60000)
  usedPorts  Int         @default(0)

  proxies    Proxy[]
  ipPools    IpPool[]
  ports      Port[]

  createdAt  DateTime    @default(now())
}

model IpPool {
  id             BigInt   @id @default(autoincrement())
  nodeId         Int
  node           Node     @relation(fields: [nodeId], references: [id])

  ipv6           String   @db.VarChar(64)

  status         IpStatus @default(free)
  cooldownUntil  DateTime?
  lastUsedAt     DateTime?
  usageCount     Int      @default(0)

  proxy          Proxy?

  @@index([nodeId, status])
}

model Port {
  id        BigInt     @id @default(autoincrement())
  nodeId    Int
  node      Node       @relation(fields: [nodeId], references: [id])

  port      Int
  status    PortStatus @default(free)

  proxy     Proxy?

  @@unique([nodeId, port])
  @@index([nodeId, status])
}

model Proxy {
  id         BigInt       @id @default(autoincrement())

  userId     BigInt

  nodeId     Int
  node       Node         @relation(fields: [nodeId], references: [id])

  ipPoolId   BigInt       @unique
  ipPool     IpPool       @relation(fields: [ipPoolId], references: [id])

  portId     BigInt       @unique
  port       Port         @relation(fields: [portId], references: [id])

  username   String       @db.VarChar(50)
  password   String       @db.VarChar(50)

  status     ProxyStatus  @default(active)
  expiresAt  DateTime

  createdAt  DateTime     @default(now())

  traffic    TrafficStat[]
}

model TrafficStat {
  id        BigInt   @id @default(autoincrement())

  proxyId   BigInt
  proxy     Proxy    @relation(fields: [proxyId], references: [id])

  bytesIn   BigInt
  bytesOut  BigInt

  createdAt DateTime @default(now())

  @@index([proxyId, createdAt])
}

model NodeHeartbeat {
  nodeId   Int      @id
  node     Node     @relation(fields: [nodeId], references: [id])

  lastSeen DateTime
}