"use server";

import { redirect } from "next/navigation";
import { AttemptStatus, ExamStatus, Role, SubmissionReason } from "@/app/generated/prisma/enums";
import { AuthorizationError, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { evaluateAttemptEligibility, isAttemptExpired } from "@/lib/exams/attempt-timing";
import { submitAttempt } from "@/lib/exams/submission";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveResponseSchema } from "@/lib/validation/attempts";
import { zh } from "@/lib/i18n/zh";

export async function startAttemptAction(formData: FormData) {
  const student = await requireUser({ roles: [Role.STUDENT] });
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const assignment = await db.assignment.findFirst({
    where: { id: assignmentId, studentProfile: { userId: student.id } },
    include: { examVersion: true, attempts: { where: { studentId: student.id }, orderBy: { attemptNumber: "desc" } } },
  });
  if (!assignment) throw new AuthorizationError(zh.errors.assignmentNotFound, 404);
  const inProgress = assignment.attempts.find((attempt) => attempt.status === AttemptStatus.IN_PROGRESS);
  if (inProgress && !isAttemptExpired(inProgress.expiresAt)) redirect(`/student/attempts/${inProgress.id}`);
  if (inProgress) await submitAttempt(inProgress.id, student.id, SubmissionReason.TIME_EXPIRED);

  const completedCount = assignment.attempts.filter((attempt) => attempt.status !== AttemptStatus.IN_PROGRESS).length + (inProgress ? 1 : 0);
  const eligibility = evaluateAttemptEligibility({
    now: new Date(),
    examEnabled: assignment.examVersion.status === ExamStatus.ENABLED,
    availableFrom: assignment.availableFrom,
    dueAt: assignment.dueAt,
    maxAttempts: assignment.maxAttempts,
    completedAttemptCount: completedCount,
    timeLimitMinutes: assignment.timeLimitMinutes,
  });
  if (!eligibility.allowed) throw new Error(zh.errors.cannotStart(eligibility.reason));
  const attempt = await db.attempt.create({
    data: {
      assignmentId: assignment.id,
      examVersionId: assignment.examVersionId,
      studentId: student.id,
      attemptNumber: Math.max(0, ...assignment.attempts.map((item) => item.attemptNumber)) + 1,
      expiresAt: eligibility.expiresAt,
    },
  });
  redirect(`/student/attempts/${attempt.id}`);
}

export async function saveResponseAction(rawInput: unknown) {
  const student = await requireUser({ roles: [Role.STUDENT] });
  const input = saveResponseSchema.parse(rawInput);
  const limit = await checkRateLimit("autosave", `${student.id}:${input.attemptId}`);
  if (!limit.success) return { ok: false as const, reason: "RATE_LIMITED" as const };
  const attempt = await db.attempt.findFirst({
    where: { id: input.attemptId, studentId: student.id },
    select: { id: true, status: true, expiresAt: true, examVersionId: true },
  });
  if (!attempt) throw new AuthorizationError(zh.errors.attemptNotFound, 404);
  if (attempt.status !== AttemptStatus.IN_PROGRESS) return { ok: false as const, reason: "ALREADY_SUBMITTED" as const };
  if (isAttemptExpired(attempt.expiresAt)) {
    await submitAttempt(attempt.id, student.id, SubmissionReason.TIME_EXPIRED);
    return { ok: false as const, reason: "EXPIRED" as const };
  }
  const question = await db.question.findFirst({
    where: { id: input.questionId, examVersionId: attempt.examVersionId },
    include: { options: { select: { id: true } } },
  });
  if (!question) throw new AuthorizationError(zh.errors.invalidQuestion, 404);
  const allowedOptions = new Set(question.options.map((option) => option.id));
  if (input.selectedOptionIds.some((id) => !allowedOptions.has(id))) throw new Error(zh.errors.invalidOption);

  const result = await db.$transaction(async (tx) => {
    const existing = await tx.response.findUnique({
      where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
    });
    if (existing && existing.version !== input.expectedVersion) return { conflict: true as const, version: existing.version };
    const response = existing
      ? await tx.response.update({ where: { id: existing.id }, data: { textAnswer: input.textAnswer ?? null, booleanAnswer: input.booleanAnswer ?? null, numericAnswer: input.numericAnswer ?? null, answeredAt: new Date(), version: { increment: 1 } } })
      : await tx.response.create({ data: { attemptId: attempt.id, questionId: question.id, textAnswer: input.textAnswer ?? null, booleanAnswer: input.booleanAnswer ?? null, numericAnswer: input.numericAnswer ?? null, version: 1 } });
    await tx.responseSelectedOption.deleteMany({ where: { responseId: response.id } });
    if (input.selectedOptionIds.length) await tx.responseSelectedOption.createMany({ data: input.selectedOptionIds.map((optionId) => ({ responseId: response.id, optionId })) });
    return { conflict: false as const, version: response.version };
  });
  if (result.conflict) return { ok: false as const, reason: "CONFLICT" as const, version: result.version };
  return { ok: true as const, version: result.version, savedAt: new Date().toISOString() };
}

export async function submitAttemptAction(input: { attemptId: string }) {
  const student = await requireUser({ roles: [Role.STUDENT] });
  const limit = await checkRateLimit("submit", `${student.id}:${input.attemptId}`);
  if (!limit.success) throw new Error(zh.errors.tooManySubmissions);
  await submitAttempt(input.attemptId, student.id);
  return { ok: true as const };
}
