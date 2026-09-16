"use server";

import { revalidatePath } from "next/cache";
import { AttemptStatus, GradingMode, Role } from "@/app/generated/prisma/enums";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { manualGradeSchema } from "@/lib/validation/attempts";
import { zh } from "@/lib/i18n/zh";

export async function gradeResponseAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const limit = await checkRateLimit("grading", teacher.id);
  if (!limit.success) throw new Error(zh.errors.tooManyOperations);
  const input = manualGradeSchema.parse({
    responseId: formData.get("responseId"),
    score: formData.get("score"),
    feedbackMd: formData.get("feedbackMd") || undefined,
    attemptFeedbackMd: formData.get("attemptFeedbackMd") || undefined,
  });
  const response = await db.response.findFirst({
    where: {
      id: input.responseId,
      question: { gradingMode: GradingMode.MANUAL },
      attempt: { examVersion: { exam: { ownerId: teacher.id } }, student: { studentTeachers: { some: { teacherId: teacher.id } } }, status: { in: [AttemptStatus.PENDING_REVIEW, AttemptStatus.GRADED] } },
    },
    include: { question: true, attempt: true },
  });
  if (!response) throw new Error(zh.errors.reviewQuestionNotFound);
  if (input.score > response.question.points.toNumber()) throw new Error(zh.errors.scoreTooHigh);

  await db.$transaction(async (tx) => {
    await tx.manualGrade.upsert({
      where: { responseId: response.id },
      create: { responseId: response.id, graderId: teacher.id, score: input.score, feedbackMd: input.feedbackMd },
      update: { graderId: teacher.id, score: input.score, feedbackMd: input.feedbackMd, gradedAt: new Date() },
    });
    const manualResponses = await tx.response.findMany({
      where: { attemptId: response.attemptId, question: { gradingMode: GradingMode.MANUAL } },
      include: { manualGrade: true },
    });
    const pending = manualResponses.filter((item) => !item.manualGrade && item.id !== response.id).length;
    const manualScore = manualResponses.reduce((sum, item) => sum + (item.id === response.id ? input.score : item.manualGrade?.score.toNumber() ?? 0), 0);
    const finalScore = (response.attempt.autoScore?.toNumber() ?? 0) + manualScore;
    await tx.attempt.update({
      where: { id: response.attemptId },
      data: {
        pendingManualCount: pending,
        status: pending === 0 ? AttemptStatus.GRADED : AttemptStatus.PENDING_REVIEW,
        finalScore: pending === 0 ? finalScore : null,
        gradedAt: pending === 0 ? new Date() : null,
        teacherFeedbackMd: input.attemptFeedbackMd || response.attempt.teacherFeedbackMd,
      },
    });
    await tx.auditLog.create({ data: { actorId: teacher.id, action: "MANUAL_GRADE_SAVED", entityType: "Response", entityId: response.id } });
  });
  revalidatePath("/teacher/review");
}
