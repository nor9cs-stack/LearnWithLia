import type { GradableQuestion } from "@/lib/exams/grading";
import { zh } from "@/lib/i18n/zh";

export type PublishQuestion = GradableQuestion & {
  promptMd: string;
  order: number;
  optionCount: number;
  referenceAnswerMd?: string | null;
  rubricMd?: string | null;
  gradingNotesMd?: string | null;
};

export type PublishIssue = { questionId?: string; field: string; message: string };

export function validateExamForPublishing(questions: readonly PublishQuestion[]) {
  const issues: PublishIssue[] = [];
  if (questions.length === 0) {
    issues.push({ field: "questions", message: zh.publication.needsQuestion });
  }

  for (const question of questions) {
    const label = zh.common.question(question.order + 1);
    if (!question.promptMd.trim()) {
      issues.push({ questionId: question.id, field: "promptMd", message: zh.publication.missingPrompt(label) });
    }
    if (!(question.points > 0)) {
      issues.push({ questionId: question.id, field: "points", message: zh.publication.invalidPoints(label) });
    }
    if (
      (question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") &&
      question.optionCount < 2
    ) {
      issues.push({ questionId: question.id, field: "options", message: zh.publication.needsOptions(label) });
    }
    if (question.type === "ESSAY" && question.gradingMode !== "MANUAL") {
      issues.push({ questionId: question.id, field: "gradingMode", message: zh.publication.essayManualOnly(label) });
    }

    if (question.gradingMode === "AUTO") {
      const hasAnswer =
        ((question.type === "SINGLE_CHOICE" || question.type === "MULTIPLE_CHOICE") &&
          Boolean(question.correctOptionIds?.length)) ||
        (question.type === "TRUE_FALSE" && typeof question.trueFalseAnswer === "boolean") ||
        ((question.type === "FILL_BLANK" || question.type === "SHORT_ANSWER") &&
          (Boolean(question.acceptableAnswers?.length) || question.numericAnswer != null));
      if (!hasAnswer) {
        issues.push({ questionId: question.id, field: "answer", message: zh.publication.missingAutoAnswer(label) });
      }
    } else if (
      !question.referenceAnswerMd?.trim() &&
      !question.rubricMd?.trim() &&
      !question.gradingNotesMd?.trim()
    ) {
      issues.push({ questionId: question.id, field: "rubric", message: zh.publication.missingRubric(label) });
    }
  }

  return { valid: issues.length === 0, issues };
}
