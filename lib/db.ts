import "server-only";

import { PrismaClient } from "@/app/generated/prisma/client";
import { createDatabaseAdapter } from "@/lib/database-adapter";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
let databaseClient: PrismaClient | undefined;

function getDatabaseClient() {
  const existingClient = databaseClient ?? globalForPrisma.prisma;
  if (existingClient) {
    databaseClient = existingClient;
    return existingClient;
  }
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL_REQUIRED");
  const client = new PrismaClient({ adapter: createDatabaseAdapter(connectionString) });
  databaseClient = client;
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getDatabaseClient();
    const value = Reflect.get(client, property, client) as unknown;
    return typeof value === "function" ? value.bind(client) : value;
  },
});
