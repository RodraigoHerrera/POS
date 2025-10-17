// /lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'], // o ['query'] si estás depurando
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
