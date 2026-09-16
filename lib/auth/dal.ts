import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { Role, UserStatus } from "@/app/generated/prisma/enums";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { zh } from "@/lib/i18n/zh";

export class AuthorizationError extends Error {
  readonly status: number;

  constructor(message: string = zh.errors.unauthorized, status = 403) {
    super(message);
    this.name = "AuthorizationError";
    this.status = status;
  }
}

export const getActiveUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      archivedAt: true,
      mustChangePassword: true,
      sessionVersion: true,
      studentProfile: { select: { id: true, studentNumber: true } },
    },
  });

  if (
    !user ||
    user.status !== UserStatus.ACTIVE ||
    user.archivedAt ||
    user.sessionVersion !== session.user.sessionVersion
  ) {
    return null;
  }

  return user;
});

export async function requireUser(options?: {
  roles?: readonly Role[];
  allowPasswordChange?: boolean;
}) {
  const user = await getActiveUser();
  if (!user) throw new AuthorizationError(zh.errors.loginRequired, 401);
  if (options?.roles && !options.roles.includes(user.role)) {
    throw new AuthorizationError();
  }
  if (user.mustChangePassword && !options?.allowPasswordChange) {
    throw new AuthorizationError(zh.errors.passwordChangeRequired, 428);
  }
  return user;
}

export async function requirePageUser(roles?: readonly Role[]) {
  const user = await getActiveUser();
  if (!user) redirect("/");
  if (roles && !roles.includes(user.role)) redirect("/dashboard");
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export async function assertTeacherOwnsStudent(teacherId: string, studentId: string) {
  const relation = await db.teacherStudent.findUnique({
    where: { teacherId_studentId: { teacherId, studentId } },
    select: { id: true },
  });
  if (!relation) throw new AuthorizationError(zh.errors.resourceNotFound, 404);
}

export async function assertTeacherOwnsExam(teacherId: string, examId: string) {
  const exam = await db.exam.findFirst({
    where: { id: examId, ownerId: teacherId, archivedAt: null },
    select: { id: true },
  });
  if (!exam) throw new AuthorizationError(zh.errors.resourceNotFound, 404);
}
