import { z } from "zod";
import { APP_CONFIG } from "@/lib/config";

export const createExamSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1_000).optional(),
});

export const questionInputSchema = z.object({
  questionId: z.string().cuid(),
  type: z.enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TRUE_FALSE", "FILL_BLANK", "SHORT_ANSWER", "ESSAY"]),
  gradingMode: z.enum(["AUTO", "MANUAL"]),
  promptMd: z.string().trim().min(1).max(20_000),
  passageMd: z.string().max(50_000).default(""),
  points: z.coerce.number().positive().max(10_000),
  optionsText: z.string().max(20_000).default(""),
  correctOptionKeys: z.string().max(200).default(""),
  trueFalseAnswer: z.enum(["true", "false", ""]).default(""),
  acceptableAnswers: z.string().max(10_000).default(""),
  numericAnswer: z.string().max(100).default(""),
  numericTolerance: z.string().max(100).default(""),
  referenceAnswerMd: z.string().max(20_000).default(""),
  rubricMd: z.string().max(20_000).default(""),
  gradingNotesMd: z.string().max(20_000).default(""),
  caseSensitive: z.boolean().default(false),
  trimWhitespace: z.boolean().default(true),
  normalizePunctuation: z.boolean().default(false),
});

export const reorderQuestionsSchema = z.object({
  versionId: z.string().cuid(),
  orderedQuestionIds: z.array(z.string().cuid()).min(1).max(300),
});

export const assignmentSchema = z.object({
  versionId: z.string().cuid(),
  studentIds: z.array(z.string().cuid()).min(1),
  availableFrom: z.string().optional(),
  dueAt: z.string().optional(),
  maxAttempts: z.union([z.literal(""), z.coerce.number().int().positive().max(100)]).optional(),
  timeLimitMinutes: z
    .union([
      z.literal(""),
      z.coerce
        .number()
        .int()
        .min(APP_CONFIG.attempts.minTimeLimitMinutes)
        .max(APP_CONFIG.attempts.maxTimeLimitMinutes),
    ])
    .optional(),
});
