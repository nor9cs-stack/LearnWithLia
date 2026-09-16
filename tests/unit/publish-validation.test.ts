import { describe, expect, it } from "vitest";
import { validateExamForPublishing, type PublishQuestion } from "@/lib/exams/publish-validation";

const valid: PublishQuestion = {
  id: "q1",
  promptMd: "Choose the answer",
  order: 0,
  type: "SINGLE_CHOICE",
  gradingMode: "AUTO",
  points: 2,
  optionCount: 2,
  correctOptionIds: ["a"],
  caseSensitive: false,
  trimWhitespace: true,
  normalizePunctuation: false,
};

describe("exam publication validation", () => {
  it("rejects an empty exam", () => {
    expect(validateExamForPublishing([]).issues[0]?.field).toBe("questions");
  });

  it("reports every missing field with the question id", () => {
    const result = validateExamForPublishing([{ ...valid, promptMd: "", points: 0, optionCount: 1, correctOptionIds: [] }]);
    expect(result.valid).toBe(false);
    expect(result.issues.map((issue) => issue.field)).toEqual(["promptMd", "points", "options", "answer"]);
    expect(result.issues.every((issue) => issue.questionId === "q1")).toBe(true);
  });

  it("requires teacher guidance for manual questions", () => {
    const result = validateExamForPublishing([{ ...valid, type: "ESSAY", gradingMode: "MANUAL", optionCount: 0, correctOptionIds: undefined }]);
    expect(result.issues.some((issue) => issue.field === "rubric")).toBe(true);
    expect(validateExamForPublishing([{ ...valid, type: "ESSAY", gradingMode: "MANUAL", optionCount: 0, correctOptionIds: undefined, rubricMd: "Ideas 5 / Language 5" }]).valid).toBe(true);
  });
});
