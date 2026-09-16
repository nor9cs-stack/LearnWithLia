import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import type { PoolConfig } from "pg";
import { z } from "zod";

const databaseUrlSchema = z.object({
  protocol: z.enum(["postgres:", "postgresql:"]),
  hostname: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65_535),
  username: z.string().min(1),
  password: z.string().min(1),
  database: z.string().min(1),
});

const connectionLimitSchema = z.coerce.number().int().min(1).max(100);
const supabaseCaPath = resolve(
  process.cwd(),
  "certificates",
  "supabase-root-2021-ca.crt",
);

let supabaseCa: string | undefined;

function isSupabaseHost(hostname: string) {
  return hostname.endsWith(".supabase.com") || hostname.endsWith(".supabase.co");
}

function readSupabaseCa() {
  supabaseCa ??= readFileSync(supabaseCaPath, "utf8");
  return supabaseCa;
}

function createSupabasePoolConfig(url: URL): PoolConfig {
  const parsed = databaseUrlSchema.parse({
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port || "5432",
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
  });
  const connectionLimit = url.searchParams.get("connection_limit");

  return {
    host: parsed.hostname,
    port: parsed.port,
    user: parsed.username,
    password: parsed.password,
    database: parsed.database,
    max: connectionLimit ? connectionLimitSchema.parse(connectionLimit) : undefined,
    ssl: {
      ca: readSupabaseCa(),
      rejectUnauthorized: true,
    },
  };
}

export function createDatabaseAdapter(connectionString: string) {
  const url = new URL(connectionString);

  if (!isSupabaseHost(url.hostname)) {
    return new PrismaPg({ connectionString });
  }

  return new PrismaPg(createSupabasePoolConfig(url));
}
