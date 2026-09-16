import { z } from "zod";
import { zh } from "@/lib/i18n/zh";

export const loginSchema = z.object({
  kind: z.enum(["student", "teacher"]),
  identifier: z.string().trim().min(1).max(254),
  password: z.string().min(8).max(256),
});

export const passwordSchema = z
  .string()
  .min(12, zh.validation.passwordLength)
  .max(256)
  .regex(/[A-Za-z]/, zh.validation.passwordLetter)
  .regex(/[0-9]/, zh.validation.passwordNumber)
  .regex(/[^A-Za-z0-9]/, zh.validation.passwordSymbol);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: zh.validation.passwordMismatch,
  });
