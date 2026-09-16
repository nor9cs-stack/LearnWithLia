import "server-only";

import { PrismaClient } from "@/app/generated/prisma/client";
import { createDatabaseAdapter } from "@/lib/database-adapter";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");

const adapter = createDatabaseAdapter(connectionString);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
