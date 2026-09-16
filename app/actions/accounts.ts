"use server";

import { revalidatePath } from "next/cache";
import { Role, UserStatus } from "@/app/generated/prisma/enums";
import { hashPassword } from "@/lib/auth/password";
import { assertTeacherOwnsStudent, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { zh } from "@/lib/i18n/zh";
import {
  createStudentSchema,
  createTeacherSchema,
  resetPasswordSchema,
  userStatusSchema,
} from "@/lib/validation/accounts";

async function requireSensitiveLimit(userId: string) {
  const result = await checkRateLimit("sensitive", userId);
  if (!result.success) throw new Error(zh.errors.tooManyOperations);
}

export async function createTeacherAction(formData: FormData) {
  const owner = await requireUser({ roles: [Role.OWNER] });
  await requireSensitiveLimit(owner.id);
  const input = createTeacherSchema.parse({
    name: formData.get("name"),
    email: formData.get("email"),
    temporaryPassword: formData.get("temporaryPassword"),
  });
  const passwordHash = await hashPassword(input.temporaryPassword);

  await db.$transaction(async (tx) => {
    const teacher = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        emailNormalized: input.email,
        passwordHash,
        role: Role.TEACHER,
        mustChangePassword: true,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: owner.id,
        action: "TEACHER_CREATED",
        entityType: "User",
        entityId: teacher.id,
        metadata: { email: input.email },
      },
    });
  });
  revalidatePath("/owner/teachers");
}

export async function createStudentAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  await requireSensitiveLimit(teacher.id);
  const input = createStudentSchema.parse({
    name: formData.get("name"),
    studentNumber: formData.get("studentNumber"),
    temporaryPassword: formData.get("temporaryPassword"),
  });
  const normalized = input.studentNumber.toLowerCase();
  const passwordHash = await hashPassword(input.temporaryPassword);

  await db.$transaction(async (tx) => {
    const student = await tx.user.create({
      data: {
        name: input.name,
        role: Role.STUDENT,
        passwordHash,
        mustChangePassword: true,
        studentProfile: {
          create: {
            studentNumber: input.studentNumber,
            studentNumberNormalized: normalized,
          },
        },
      },
    });
    await tx.teacherStudent.create({
      data: { teacherId: teacher.id, studentId: student.id },
    });
    await tx.auditLog.create({
      data: {
        actorId: teacher.id,
        action: "STUDENT_CREATED",
        entityType: "User",
        entityId: student.id,
        metadata: { studentNumber: input.studentNumber },
      },
    });
  });
  revalidatePath("/teacher/students");
}

export async function resetAccountPasswordAction(formData: FormData) {
  const actor = await requireUser({ roles: [Role.OWNER, Role.TEACHER] });
  await requireSensitiveLimit(actor.id);
  const input = resetPasswordSchema.parse({
    userId: formData.get("userId"),
    temporaryPassword: formData.get("temporaryPassword"),
  });
  const target = await db.user.findUnique({ where: { id: input.userId } });
  if (!target) throw new Error(zh.errors.accountNotFound);
  if (actor.role === Role.OWNER && target.role !== Role.TEACHER) throw new Error(zh.errors.accountNotFound);
  if (actor.role === Role.TEACHER) {
    if (target.role !== Role.STUDENT) throw new Error(zh.errors.accountNotFound);
    await assertTeacherOwnsStudent(actor.id, target.id);
  }

  const passwordHash = await hashPassword(input.temporaryPassword);
  await db.$transaction([
    db.user.update({
      where: { id: target.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        sessionVersion: { increment: 1 },
        passwordChangedAt: new Date(),
      },
    }),
    db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "ACCOUNT_PASSWORD_RESET",
        entityType: "User",
        entityId: target.id,
      },
    }),
  ]);
  revalidatePath(actor.role === Role.OWNER ? "/owner/teachers" : "/teacher/students");
}

export async function setAccountStatusAction(formData: FormData) {
  const actor = await requireUser({ roles: [Role.OWNER, Role.TEACHER] });
  await requireSensitiveLimit(actor.id);
  const input = userStatusSchema.parse({
    userId: formData.get("userId"),
    status: formData.get("status"),
  });
  const target = await db.user.findUnique({ where: { id: input.userId } });
  if (!target) throw new Error(zh.errors.accountNotFound);
  if (actor.role === Role.OWNER && target.role !== Role.TEACHER) throw new Error(zh.errors.accountNotFound);
  if (actor.role === Role.TEACHER) {
    if (target.role !== Role.STUDENT) throw new Error(zh.errors.accountNotFound);
    await assertTeacherOwnsStudent(actor.id, target.id);
  }

  await db.$transaction([
    db.user.update({
      where: { id: target.id },
      data: {
        status: input.status as UserStatus,
        sessionVersion: { increment: 1 },
      },
    }),
    db.auditLog.create({
      data: {
        actorId: actor.id,
        action: input.status === "ACTIVE" ? "ACCOUNT_ACTIVATED" : "ACCOUNT_DISABLED",
        entityType: "User",
        entityId: target.id,
      },
    }),
  ]);
  revalidatePath(actor.role === Role.OWNER ? "/owner/teachers" : "/teacher/students");
}
