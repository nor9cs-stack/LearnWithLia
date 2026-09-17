import { AttemptStatus, SubmissionReason } from "@/app/generated/prisma/enums";
import { statusLabel, zh } from "@/lib/i18n/zh";

export function createAttemptHistoryDisplay(input: {
  status: AttemptStatus;
  submissionReason: SubmissionReason | null;
  autoCorrectCount: number | null;
  autoQuestionCount: number | null;
  pendingManualCount: number | null;
  finalScore: string | null;
  totalPoints: string;
}) {
  const accuracy = input.autoQuestionCount
    ? Math.round(((input.autoCorrectCount ?? 0) / input.autoQuestionCount) * 100)
    : null;
  return {
    statusLabel: statusLabel(input.status),
    autoResult: accuracy == null ? zh.studentExams.waitingForGrade : zh.studentExams.autoAccuracy(accuracy),
    finalResult:
      input.pendingManualCount || input.status !== AttemptStatus.GRADED || input.finalScore == null
        ? zh.studentExams.waitingForGrade
        : `${input.finalScore} / ${input.totalPoints}`,
    expired: input.submissionReason === SubmissionReason.TIME_EXPIRED,
  };
}
