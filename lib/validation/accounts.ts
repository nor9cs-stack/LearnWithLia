import { z } from "zod";
import { passwordSchema } from "@/lib/validation/auth";
import { zh } from "@/lib/i18n/zh";

export const createTeacherSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  temporaryPassword: passwordSchema,
});

export const createStudentSchema = z.object({
  name: z.string().trim().min(1).max(80),
  studentNumber: z
    .string()
    .trim()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, zh.validation.studentNumber),
  temporaryPassword: passwordSchema,
});

export const resetPasswordSchema = z.object({
  userId: z.string().cuid(),
  temporaryPassword: passwordSchema,
});

export const userStatusSchema = z.object({
  userId: z.string().cuid(),
  status: z.enum(["ACTIVE", "DISABLED"]),
});
