import { describe, expect, it } from "vitest";
import { AttemptStatus, SubmissionReason } from "@/app/generated/prisma/enums";
import { createAttemptHistoryDisplay } from "@/lib/exams/history";

describe("attempt history presentation", () => {
  it("keeps partial automatic results from looking like a final grade", () => {
    expect(createAttemptHistoryDisplay({ status: AttemptStatus.PENDING_REVIEW, submissionReason: SubmissionReason.STUDENT, autoCorrectCount: 5, autoQuestionCount: 5, pendingManualCount: 1, finalScore: null, totalPoints: "12" }))
      .toMatchObject({ statusLabel: "待批改", autoResult: "100% 自动正确率", finalResult: "等待评分", expired: false });
  });

  it("shows a final score only when graded and labels timed expiry", () => {
    expect(createAttemptHistoryDisplay({ status: AttemptStatus.GRADED, submissionReason: SubmissionReason.TIME_EXPIRED, autoCorrectCount: 4, autoQuestionCount: 5, pendingManualCount: 0, finalScore: "9.5", totalPoints: "12" }))
      .toMatchObject({ statusLabel: "已评分", finalResult: "9.5 / 12", expired: true });
  });
});
