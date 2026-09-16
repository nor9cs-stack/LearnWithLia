"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { zh } from "@/lib/i18n/zh";
import { changePasswordSchema, loginSchema } from "@/lib/validation/auth";

export type AuthActionState = { error?: string };

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    kind: formData.get("kind"),
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: zh.auth.invalidCredentials };

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/dashboard" });
  } catch (error) {
    if (error instanceof AuthError) return { error: zh.auth.invalidCredentials };
    throw error;
  }
  return {};
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireUser({ allowPasswordChange: true });
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? zh.auth.passwordInvalid);
  }

  const record = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await verifyPassword(record.passwordHash, parsed.data.currentPassword))) {
    throw new Error(zh.auth.currentPasswordIncorrect);
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: false,
      passwordChangedAt: new Date(),
      sessionVersion: { increment: 1 },
    },
  });
  await signOut({ redirect: false });
  redirect("/");
}
