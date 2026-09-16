export type NormalizationOptions = {
  caseSensitive: boolean;
  trimWhitespace: boolean;
  normalizePunctuation: boolean;
};

export type GradableQuestion = NormalizationOptions & {
  id: string;
  type: "SINGLE_CHOICE" | "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_BLANK" | "SHORT_ANSWER" | "ESSAY";
  gradingMode: "AUTO" | "MANUAL";
  points: number;
  correctOptionIds?: readonly string[];
  trueFalseAnswer?: boolean | null;
  acceptableAnswers?: readonly string[];
  numericAnswer?: number | null;
  numericTolerance?: number | null;
};

export type SubmittedAnswer = {
  selectedOptionIds?: readonly string[];
  booleanAnswer?: boolean | null;
  textAnswer?: string | null;
  numericAnswer?: number | null;
};

export type GradeResult =
  | { kind: "auto"; correct: boolean; score: number }
  | { kind: "manual"; correct: null; score: null };

const punctuationPattern = /[\p{P}\p{S}]/gu;

export function normalizeAnswer(value: string, options: NormalizationOptions) {
  let normalized = value.normalize("NFKC");
  if (options.trimWhitespace) normalized = normalized.trim().replace(/\s+/g, " ");
  if (options.normalizePunctuation) normalized = normalized.replace(punctuationPattern, "");
  if (!options.caseSensitive) normalized = normalized.toLocaleLowerCase("en-US");
  return normalized;
}

function setsEqual(left: readonly string[], right: readonly string[]) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

export function gradeQuestion(question: GradableQuestion, answer: SubmittedAnswer): GradeResult {
  if (question.gradingMode === "MANUAL" || question.type === "ESSAY") {
    return { kind: "manual", correct: null, score: null };
  }

  let correct = false;
  switch (question.type) {
    case "SINGLE_CHOICE":
    case "MULTIPLE_CHOICE":
      correct = setsEqual(answer.selectedOptionIds ?? [], question.correctOptionIds ?? []);
      break;
    case "TRUE_FALSE":
      correct =
        typeof answer.booleanAnswer === "boolean" &&
        answer.booleanAnswer === question.trueFalseAnswer;
      break;
    case "FILL_BLANK":
    case "SHORT_ANSWER": {
      const numericAnswer = answer.numericAnswer ?? Number(answer.textAnswer);
      if (
        question.numericAnswer != null &&
        Number.isFinite(numericAnswer) &&
        question.numericTolerance != null
      ) {
        correct = Math.abs(numericAnswer - question.numericAnswer) <= question.numericTolerance;
        break;
      }
      const normalized = normalizeAnswer(answer.textAnswer ?? "", question);
      correct = (question.acceptableAnswers ?? []).some(
        (accepted) => normalizeAnswer(accepted, question) === normalized,
      );
      break;
    }
  }

  return { kind: "auto", correct, score: correct ? question.points : 0 };
}

export function summarizeGrades(
  grades: readonly { questionId: string; points: number; result: GradeResult }[],
) {
  const auto = grades.filter((grade) => grade.result.kind === "auto");
  const pending = grades.filter((grade) => grade.result.kind === "manual");
  const correctCount = auto.filter(
    (grade) => grade.result.kind === "auto" && grade.result.correct,
  ).length;
  const autoScore = auto.reduce(
    (sum, grade) => sum + (grade.result.kind === "auto" ? grade.result.score : 0),
    0,
  );
  return {
    autoCorrectCount: correctCount,
    autoQuestionCount: auto.length,
    autoAccuracy: auto.length === 0 ? null : Math.round((correctCount / auto.length) * 100),
    autoScore,
    pendingManualCount: pending.length,
  };
}
