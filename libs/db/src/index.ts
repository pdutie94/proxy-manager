import { PrismaClient } from '@prisma/client';

// Prisma client singleton
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Export types
export * from '@prisma/client';

// Export enums
export {
  NodeStatus,
  ProxyStatus,
  IpStatus,
  PortStatus,
  EventOutboxStatus,
} from '@prisma/client';
