import { describe, expect, it } from "vitest";
import { gradeQuestion, normalizeAnswer, summarizeGrades, type GradableQuestion } from "@/lib/exams/grading";

const base: GradableQuestion = {
  id: "q1",
  type: "FILL_BLANK",
  gradingMode: "AUTO",
  points: 4,
  caseSensitive: false,
  trimWhitespace: true,
  normalizePunctuation: false,
  acceptableAnswers: ["New York", "NYC"],
};

describe("answer normalization", () => {
  it("normalizes whitespace, case and Unicode", () => {
    expect(normalizeAnswer("  ＮＥＷ   York  ", base)).toBe("new york");
  });

  it("optionally normalizes punctuation", () => {
    expect(normalizeAnswer("Hello, world!", { ...base, normalizePunctuation: true })).toBe("hello world");
  });
});

describe("server grading", () => {
  it("accepts any configured text answer", () => {
    expect(gradeQuestion(base, { textAnswer: "  nyc " })).toEqual({ kind: "auto", correct: true, score: 4 });
  });

  it("requires an exact option set for multiple choice", () => {
    const question = { ...base, type: "MULTIPLE_CHOICE" as const, correctOptionIds: ["a", "c"] };
    expect(gradeQuestion(question, { selectedOptionIds: ["c", "a"] }).correct).toBe(true);
    expect(gradeQuestion(question, { selectedOptionIds: ["a"] }).correct).toBe(false);
    expect(gradeQuestion(question, { selectedOptionIds: ["a", "b", "c"] }).correct).toBe(false);
  });

  it("handles inclusive numeric tolerance boundaries", () => {
    const question = { ...base, numericAnswer: 10, numericTolerance: 0.25, acceptableAnswers: [] };
    expect(gradeQuestion(question, { numericAnswer: 10.25 }).correct).toBe(true);
    expect(gradeQuestion(question, { numericAnswer: 10.251 }).correct).toBe(false);
  });

  it("keeps essays and manual short answers pending", () => {
    expect(gradeQuestion({ ...base, type: "ESSAY", gradingMode: "MANUAL" }, { textAnswer: "Essay" })).toEqual({ kind: "manual", correct: null, score: null });
    expect(gradeQuestion({ ...base, type: "SHORT_ANSWER", gradingMode: "MANUAL" }, { textAnswer: "Response" }).kind).toBe("manual");
  });

  it("calculates auto accuracy separately from pending manual questions", () => {
    expect(summarizeGrades([
      { questionId: "q1", points: 2, result: { kind: "auto", correct: true, score: 2 } },
      { questionId: "q2", points: 3, result: { kind: "auto", correct: false, score: 0 } },
      { questionId: "q3", points: 10, result: { kind: "manual", correct: null, score: null } },
    ])).toEqual({ autoCorrectCount: 1, autoQuestionCount: 2, autoAccuracy: 50, autoScore: 2, pendingManualCount: 1 });
  });
});
