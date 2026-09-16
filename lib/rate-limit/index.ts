import "server-only";

import { createHmac } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

type Policy = "login-ip" | "login-identifier" | "upload" | "sensitive" | "autosave" | "submit" | "grading";

const policyConfig = {
  "login-ip": [10, "10 m"],
  "login-identifier": [5, "10 m"],
  upload: [10, "1 h"],
  sensitive: [20, "1 h"],
  autosave: [120, "1 m"],
  submit: [30, "1 m"],
  grading: [60, "1 m"],
} as const;

const instances = new Map<Policy, Ratelimit>();

function getInstance(policy: Policy) {
  const existing = instances.get(policy);
  if (existing) return existing;

  const [tokens, window] = policyConfig[policy];
  const instance = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: `learnwithlia:${policy}`,
    timeout: 1_500,
  });
  instances.set(policy, instance);
  return instance;
}

export function privateIdentifier(value: string) {
  const secret = process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? null : "learnwithlia-development-only-secret");
  if (!secret) throw new Error("AUTH_SECRET_REQUIRED");
  return createHmac("sha256", secret).update(value).digest("hex");
}

export async function checkRateLimit(policy: Policy, rawIdentifier: string) {
  const configured =
    Boolean(process.env.UPSTASH_REDIS_REST_URL) &&
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN);

  if (!configured) {
    if (process.env.NODE_ENV === "production" && policy !== "autosave") {
      return { success: false, remaining: 0, reset: Date.now() + 60_000 };
    }
    return { success: true, remaining: Number.MAX_SAFE_INTEGER, reset: Date.now() };
  }

  try {
    return await getInstance(policy).limit(privateIdentifier(rawIdentifier));
  } catch {
    console.warn("RATE_LIMIT_PROVIDER_UNAVAILABLE", { policy });
    if (policy === "autosave") {
      return { success: true, remaining: 1, reset: Date.now() + 10_000 };
    }
    return { success: false, remaining: 0, reset: Date.now() + 60_000 };
  }
}
