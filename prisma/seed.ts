import "dotenv/config"; 
import { config } from "dotenv";

config();

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
  const adminPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@proxy.com" },
    update: {},
    create: {
      email: "admin@proxy.com",
      password: adminPassword,
      name: "Admin User",
      role: Role.ADMIN,
      isActive: true,
    },
  });

  const customerPassword = await bcrypt.hash("customer123", 12);

  const customer = await prisma.user.upsert({
    where: { email: "customer@proxy.com" },
    update: {},
    create: {
      email: "customer@proxy.com",
      password: customerPassword,
      name: "Customer User",
      role: Role.CUSTOMER,
      isActive: true,
    },
  });

  console.log("Seed data created successfully");
  console.log("Admin:", admin.email);
  console.log("Customer:", customer.email);
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });