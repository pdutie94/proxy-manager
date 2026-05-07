const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
Promise.all([
  prisma.node.findMany(),
  prisma.proxy.findMany({ take: 5, orderBy: { createdAt: 'desc' } })
]).then(res => {
  console.dir(res, { depth: null });
}).catch(console.error).finally(() => prisma.$disconnect());
