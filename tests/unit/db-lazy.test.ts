import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("database client initialization", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    vi.resetModules();
  });

  it("allows anonymous server modules to load without a database but fails on first database use", async () => {
    delete process.env.DATABASE_URL;
    vi.resetModules();
    const { db } = await import("@/lib/db");
    expect(() => db.user).toThrow("DATABASE_URL_REQUIRED");
  });
});
