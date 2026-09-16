"use server";

import { AttemptStatus, Role } from "@/app/generated/prisma/enums";
import { AuthorizationError, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { markdownToPlainText } from "@/lib/markdown";
import { resolveTextAnchor } from "@/lib/unknown-words/anchor";
import { unknownWordSchema } from "@/lib/validation/attempts";
import { zh } from "@/lib/i18n/zh";

export async function saveUnknownWordAction(rawInput: unknown) {
  const student = await requireUser({ roles: [Role.STUDENT] });
  const input = unknownWordSchema.parse(rawInput);
  const attempt = await db.attempt.findFirst({
    where: { id: input.attemptId, studentId: student.id, status: AttemptStatus.IN_PROGRESS, examVersion: { questions: { some: { id: input.questionId } } } },
    select: { id: true },
  });
  if (!attempt) throw new AuthorizationError(zh.errors.attemptNotFound, 404);
  const question = await db.question.findUnique({ where: { id: input.questionId }, include: { passage: true } });
  if (!question) throw new AuthorizationError(zh.errors.questionNotFound, 404);
  const source = markdownToPlainText(`${question.passage?.contentMd ?? ""} ${question.promptMd}`);
  if (!resolveTextAnchor(source, input)) throw new Error(zh.errors.anchorNotFound);
  const word = await db.unknownWord.upsert({
    where: { attemptId_questionId_exactText_prefix_suffix_occurrence: input },
    update: {},
    create: input,
  });
  return { ok: true as const, word };
}

export async function deleteUnknownWordAction(input: { id: string; attemptId: string }) {
  const student = await requireUser({ roles: [Role.STUDENT] });
  const word = await db.unknownWord.findFirst({ where: { id: input.id, attemptId: input.attemptId, attempt: { studentId: student.id, status: AttemptStatus.IN_PROGRESS } } });
  if (!word) throw new AuthorizationError(zh.errors.markNotFound, 404);
  await db.unknownWord.delete({ where: { id: word.id } });
  return { ok: true as const };
}
