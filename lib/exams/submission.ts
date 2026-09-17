import "server-only";

import { AttemptStatus, SubmissionReason } from "@/app/generated/prisma/enums";
import { AuthorizationError } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { gradeQuestion, summarizeGrades } from "@/lib/exams/grading";
import { zh } from "@/lib/i18n/zh";

export async function submitAttempt(
  attemptId: string,
  studentId: string,
  submissionReason: SubmissionReason = SubmissionReason.STUDENT,
) {
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, studentId },
    include: {
      responses: { include: { selected: true } },
      examVersion: {
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              key: { include: { correctOptions: true, acceptableAnswers: true } },
            },
          },
        },
      },
    },
  });
  if (!attempt) throw new AuthorizationError(zh.errors.attemptRecordNotFound, 404);
  if (attempt.status !== AttemptStatus.IN_PROGRESS) return attempt;

  const responseByQuestion = new Map(attempt.responses.map((response) => [response.questionId, response]));
  const grades = attempt.examVersion.questions.map((question) => {
    const response = responseByQuestion.get(question.id);
    const result = gradeQuestion(
      {
        id: question.id,
        type: question.type,
        gradingMode: question.gradingMode,
        points: question.points.toNumber(),
        correctOptionIds: question.key?.correctOptions.map((item) => item.optionId),
        trueFalseAnswer: question.key?.trueFalseAnswer,
        acceptableAnswers: question.key?.acceptableAnswers.map((item) => item.value),
        numericAnswer: question.key?.numericAnswer?.toNumber(),
        numericTolerance: question.key?.numericTolerance?.toNumber(),
        caseSensitive: question.caseSensitive,
        trimWhitespace: question.trimWhitespace,
        normalizePunctuation: question.normalizePunctuation,
      },
      {
        selectedOptionIds: response?.selected.map((item) => item.optionId),
        textAnswer: response?.textAnswer,
        booleanAnswer: response?.booleanAnswer,
        numericAnswer: response?.numericAnswer?.toNumber(),
      },
    );
    return { questionId: question.id, points: question.points.toNumber(), result, response };
  });
  const summary = summarizeGrades(grades);
  const status = summary.pendingManualCount > 0 ? AttemptStatus.PENDING_REVIEW : AttemptStatus.GRADED;

  return db.$transaction(async (tx) => {
    const claimed = await tx.attempt.updateMany({
      where: { id: attempt.id, status: AttemptStatus.IN_PROGRESS },
      data: {
        status,
        submissionReason,
        submittedAt: new Date(),
        gradedAt: status === AttemptStatus.GRADED ? new Date() : null,
        autoCorrectCount: summary.autoCorrectCount,
        autoQuestionCount: summary.autoQuestionCount,
        autoScore: summary.autoScore,
        pendingManualCount: summary.pendingManualCount,
        finalScore: status === AttemptStatus.GRADED ? summary.autoScore : null,
      },
    });
    if (claimed.count === 0) return tx.attempt.findUniqueOrThrow({ where: { id: attempt.id } });

    for (const grade of grades) {
      const response = grade.response ?? (await tx.response.create({ data: { attemptId: attempt.id, questionId: grade.questionId } }));
      if (grade.result.kind === "auto") {
        await tx.response.update({ where: { id: response.id }, data: { autoCorrect: grade.result.correct, autoScore: grade.result.score } });
      }
    }
    return tx.attempt.findUniqueOrThrow({ where: { id: attempt.id } });
  });
}
