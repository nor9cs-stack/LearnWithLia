import { describe, expect, it } from "vitest";
import { evaluateAttemptEligibility, isAttemptExpired } from "@/lib/exams/attempt-timing";

const now = new Date("2026-09-15T12:00:00Z");

describe("attempt timing", () => {
  it("uses the earlier of the time limit and assignment deadline", () => {
    const result = evaluateAttemptEligibility({ now, examEnabled: true, availableFrom: null, dueAt: new Date("2026-09-15T12:30:00Z"), maxAttempts: null, completedAttemptCount: 0, timeLimitMinutes: 60 });
    expect(result).toEqual({ allowed: true, expiresAt: new Date("2026-09-15T12:30:00Z") });
  });

  it("enforces the attempt limit and disabled exam status", () => {
    expect(evaluateAttemptEligibility({ now, examEnabled: false, availableFrom: null, dueAt: null, maxAttempts: null, completedAttemptCount: 0, timeLimitMinutes: null }).reason).toBe("EXAM_NOT_ENABLED");
    expect(evaluateAttemptEligibility({ now, examEnabled: true, availableFrom: null, dueAt: null, maxAttempts: 2, completedAttemptCount: 2, timeLimitMinutes: null }).reason).toBe("ATTEMPT_LIMIT_REACHED");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(isAttemptExpired(now, now)).toBe(true);
  });
});
