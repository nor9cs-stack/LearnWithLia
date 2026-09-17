// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ReviewList,
  type ReviewAttemptDto,
} from "@/components/grading/review-list";

const mocks = vi.hoisted(() => ({ grade: vi.fn() }));
vi.mock("@/app/actions/grading", () => ({ gradeResponseAction: mocks.grade }));

const attempts: ReviewAttemptDto[] = [
  {
    id: "attempt-1",
    isGraded: false,
    attemptLabel: "第 2 次作答",
    submittedAt: "2026/9/17 10:00:00",
    studentName: "测试学生",
    examTitle: "英语测试",
    summary: "自动正确率 1/1",
    attemptFeedback: "",
    responses: [
      {
        id: "auto-1",
        prompt: "自动题",
        studentAnswer: "A",
        reference: "A",
        points: "2",
        gradingMode: "AUTO",
        completed: true,
        autoCorrect: true,
        score: "2",
        feedback: "",
      },
      {
        id: "manual-done",
        prompt: "已评分作文",
        studentAnswer: "done",
        reference: "rubric",
        points: "2",
        gradingMode: "MANUAL",
        completed: true,
        autoCorrect: null,
        score: "1.5",
        feedback: "saved",
      },
      {
        id: "manual-pending",
        prompt: "待评分作文",
        studentAnswer: "pending",
        reference: "rubric",
        points: "2",
        gradingMode: "MANUAL",
        completed: false,
        autoCorrect: null,
        score: "",
        feedback: "",
      },
    ],
    unknownWords: [],
  },
];

describe("review completion filter", () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.grade.mockResolvedValue(undefined);
  });

  it("shows everything by default, hides completed work, and restores it", async () => {
    const user = userEvent.setup();
    render(<ReviewList attempts={attempts} />);
    expect(screen.getByTestId("review-response-auto-1")).toBeVisible();
    expect(screen.getByTestId("review-response-manual-done")).toBeVisible();
    expect(screen.getByTestId("review-response-manual-pending")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "隐藏已完成评分" }));
    expect(screen.getByTestId("review-response-auto-1")).not.toBeVisible();
    expect(screen.getByTestId("review-response-manual-done")).not.toBeVisible();
    expect(screen.getByTestId("review-response-manual-pending")).toBeVisible();

    await user.click(screen.getByRole("button", { name: "显示已完成评分" }));
    expect(screen.getByTestId("review-response-auto-1")).toBeVisible();
    expect(screen.getByTestId("review-response-manual-done")).toBeVisible();
  });

  it("preserves unsaved input while toggling", async () => {
    const user = userEvent.setup();
    render(<ReviewList attempts={attempts} />);
    const pendingForm = screen.getByTestId("review-response-manual-pending");
    const feedback = within(pendingForm).getByLabelText("题目反馈");
    await user.type(feedback, "尚未保存的评语");
    await user.click(screen.getByRole("button", { name: "隐藏已完成评分" }));
    await user.click(screen.getByRole("button", { name: "显示已完成评分" }));
    expect(feedback).toHaveValue("尚未保存的评语");
  });

  it("immediately removes a newly saved manual grade in hidden mode", async () => {
    const user = userEvent.setup();
    render(
      <ReviewList
        attempts={[
          { ...attempts[0]!, responses: [attempts[0]!.responses[2]!] },
        ]}
      />,
    );
    await user.click(screen.getByRole("button", { name: "隐藏已完成评分" }));
    const form = screen.getByTestId("review-response-manual-pending");
    fireEvent.change(within(form).getByLabelText("得分 / 2"), {
      target: { value: "1" },
    });
    await user.click(within(form).getByRole("button", { name: "保存评分" }));

    await waitFor(() => expect(mocks.grade).toHaveBeenCalledTimes(1));
    expect(form).not.toBeVisible();
    expect(screen.getByText("所有题目均已完成评分")).toBeVisible();
    const submitted = mocks.grade.mock.calls[0]?.[0] as FormData;
    expect(submitted.get("responseId")).toBe("manual-pending");
    expect(submitted.has("status")).toBe(false);
  });
});
