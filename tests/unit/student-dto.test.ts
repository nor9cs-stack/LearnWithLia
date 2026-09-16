import { describe, expect, it } from "vitest";
import { createStudentExamQuestions } from "@/lib/exams/student-dto";

describe("student exam DTO", () => {
  it("exposes only renderable question data and never answer keys", () => {
    const questions = createStudentExamQuestions(
      [{
        id: "question-1",
        type: "SINGLE_CHOICE",
        promptMd: "**请选择**正确答案",
        points: 2,
        passage: null,
        options: [{ id: "option-secret", contentMd: "公开选项" }],
      }],
      [],
      [],
    );

    expect(questions[0]).toEqual(expect.objectContaining({ promptText: "请选择正确答案", points: "2" }));
    expect(JSON.stringify(questions)).not.toMatch(/key|correctOption|acceptableAnswer|referenceAnswer|rubric/i);
  });
});
