export type AttemptEligibilityInput = {
  now: Date;
  examEnabled: boolean;
  availableFrom: Date | null;
  dueAt: Date | null;
  maxAttempts: number | null;
  completedAttemptCount: number;
  timeLimitMinutes: number | null;
};

export function evaluateAttemptEligibility(input: AttemptEligibilityInput) {
  if (!input.examEnabled) return { allowed: false as const, reason: "EXAM_NOT_ENABLED" as const };
  if (input.availableFrom && input.now < input.availableFrom) {
    return { allowed: false as const, reason: "NOT_OPEN" as const };
  }
  if (input.dueAt && input.now >= input.dueAt) {
    return { allowed: false as const, reason: "DEADLINE_PASSED" as const };
  }
  if (input.maxAttempts != null && input.completedAttemptCount >= input.maxAttempts) {
    return { allowed: false as const, reason: "ATTEMPT_LIMIT_REACHED" as const };
  }

  const timedExpiry = input.timeLimitMinutes
    ? new Date(input.now.getTime() + input.timeLimitMinutes * 60_000)
    : null;
  const expiresAt =
    timedExpiry && input.dueAt
      ? new Date(Math.min(timedExpiry.getTime(), input.dueAt.getTime()))
      : timedExpiry ?? input.dueAt;
  return { allowed: true as const, expiresAt };
}

export function isAttemptExpired(expiresAt: Date | null, now = new Date()) {
  return Boolean(expiresAt && now >= expiresAt);
}
