import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("production rate-limit fallback", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
  const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  afterEach(() => {
    Reflect.set(process.env, "NODE_ENV", originalNodeEnv);
    if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
    if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
  });

  it("fails closed for uploads when Redis is missing in production", async () => {
    Reflect.set(process.env, "NODE_ENV", "production");
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const { checkRateLimit } = await import("@/lib/rate-limit");
    await expect(checkRateLimit("upload", "teacher-test")).resolves.toMatchObject({ success: false, remaining: 0 });
  });
});
