import { z } from "zod";
import { APP_CONFIG } from "@/lib/config";

export const saveResponseSchema = z.object({
  attemptId: z.string().cuid(),
  questionId: z.string().cuid(),
  expectedVersion: z.number().int().min(0),
  selectedOptionIds: z.array(z.string().cuid()).max(20).default([]),
  textAnswer: z.string().max(50_000).nullable().optional(),
  booleanAnswer: z.boolean().nullable().optional(),
  numericAnswer: z.number().finite().nullable().optional(),
});

export const unknownWordSchema = z.object({
  attemptId: z.string().cuid(),
  questionId: z.string().cuid(),
  exactText: z.string().trim().min(1).max(APP_CONFIG.unknownWord.maxLength),
  prefix: z.string().max(160),
  suffix: z.string().max(160),
  occurrence: z.number().int().min(0).max(1_000),
});

export const manualGradeSchema = z.object({
  responseId: z.string().cuid(),
  score: z.coerce.number().min(0).max(10_000),
  feedbackMd: z.string().trim().max(20_000).optional(),
  attemptFeedbackMd: z.string().trim().max(20_000).optional(),
});
