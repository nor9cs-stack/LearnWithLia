import "server-only";

import { ExamStatus, GradingMode, QuestionType } from "@/app/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { validateExamForPublishing } from "@/lib/exams/publish-validation";
import { zh } from "@/lib/i18n/zh";

export async function getOwnedVersion(teacherId: string, versionId: string) {
  const version = await db.examVersion.findFirst({
    where: { id: versionId, exam: { ownerId: teacherId, archivedAt: null } },
    include: {
      exam: true,
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: { orderBy: { order: "asc" } },
          key: { include: { acceptableAnswers: true, correctOptions: true } },
          passage: true,
        },
      },
      uploadedFiles: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!version) throw new AuthorizationError(zh.errors.ownedExamNotFound, 404);
  return version;
}

export async function requireEditableVersion(teacherId: string, versionId: string) {
  const version = await getOwnedVersion(teacherId, versionId);
  if (version.status !== ExamStatus.DRAFT) {
    throw new Error(zh.errors.versionLocked);
  }
  return version;
}

export function versionPublicationResult(
  version: Awaited<ReturnType<typeof getOwnedVersion>>,
) {
  return validateExamForPublishing(
    version.questions.map((question) => ({
      id: question.id,
      promptMd: question.promptMd,
      order: question.order,
      type: question.type,
      gradingMode: question.gradingMode,
      points: question.points.toNumber(),
      optionCount: question.options.length,
      correctOptionIds: question.key?.correctOptions.map((item) => item.optionId),
      trueFalseAnswer: question.key?.trueFalseAnswer,
      acceptableAnswers: question.key?.acceptableAnswers.map((answer) => answer.value),
      numericAnswer: question.key?.numericAnswer?.toNumber(),
      numericTolerance: question.key?.numericTolerance?.toNumber(),
      referenceAnswerMd: question.key?.referenceAnswerMd,
      rubricMd: question.key?.rubricMd,
      gradingNotesMd: question.key?.gradingNotesMd,
      caseSensitive: question.caseSensitive,
      trimWhitespace: question.trimWhitespace,
      normalizePunctuation: question.normalizePunctuation,
    })),
  );
}

export async function cloneExamVersion(teacherId: string, versionId: string) {
  const source = await getOwnedVersion(teacherId, versionId);
  const latest = await db.examVersion.aggregate({
    where: { examId: source.examId },
    _max: { versionNumber: true },
  });

  return db.$transaction(async (tx) => {
    const clone = await tx.examVersion.create({
      data: {
        examId: source.examId,
        versionNumber: (latest._max.versionNumber ?? 0) + 1,
        status: ExamStatus.DRAFT,
        title: source.title,
        instructionsMd: source.instructionsMd,
      },
    });

    const passageMap = new Map<string, string>();
    const passages = await tx.passage.findMany({ where: { examVersionId: source.id }, orderBy: { order: "asc" } });
    for (const passage of passages) {
      const created = await tx.passage.create({ data: { examVersionId: clone.id, title: passage.title, contentMd: passage.contentMd, order: passage.order } });
      passageMap.set(passage.id, created.id);
    }

    for (const question of source.questions) {
      const created = await tx.question.create({
        data: {
          examVersionId: clone.id,
          passageId: question.passageId ? passageMap.get(question.passageId) : null,
          type: question.type,
          gradingMode: question.gradingMode,
          promptMd: question.promptMd,
          order: question.order,
          points: question.points,
          caseSensitive: question.caseSensitive,
          trimWhitespace: question.trimWhitespace,
          normalizePunctuation: question.normalizePunctuation,
        },
      });
      const optionMap = new Map<string, string>();
      for (const option of question.options) {
        const createdOption = await tx.questionOption.create({ data: { questionId: created.id, optionKey: option.optionKey, contentMd: option.contentMd, order: option.order } });
        optionMap.set(option.id, createdOption.id);
      }
      if (question.key) {
        const createdKey = await tx.questionKey.create({
          data: {
            questionId: created.id,
            trueFalseAnswer: question.key.trueFalseAnswer,
            numericAnswer: question.key.numericAnswer,
            numericTolerance: question.key.numericTolerance,
            referenceAnswerMd: question.key.referenceAnswerMd,
            rubricMd: question.key.rubricMd,
            gradingNotesMd: question.key.gradingNotesMd,
            acceptableAnswers: { create: question.key.acceptableAnswers.map((answer) => ({ value: answer.value, normalizedValue: answer.normalizedValue })) },
          },
        });
        for (const correct of question.key.correctOptions) {
          const optionId = optionMap.get(correct.optionId);
          if (optionId) await tx.questionCorrectOption.create({ data: { questionKeyId: createdKey.id, optionId } });
        }
      }
    }
    await tx.auditLog.create({ data: { actorId: teacherId, action: "EXAM_VERSION_CLONED", entityType: "ExamVersion", entityId: clone.id, metadata: { sourceVersionId: source.id } } });
    return clone;
  });
}

export const defaultQuestion = {
  type: QuestionType.SINGLE_CHOICE,
  gradingMode: GradingMode.AUTO,
  promptMd: zh.defaults.newQuestion,
  points: 1,
} as const;
