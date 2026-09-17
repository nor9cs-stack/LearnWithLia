"use server";

import { revalidatePath } from "next/cache";
import { Role, UserStatus } from "@/app/generated/prisma/enums";
import { AuthorizationError, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { deletePrivateFile } from "@/lib/storage/supabase";
import {
  textbookAssignmentSchema,
  textbookIdSchema,
} from "@/lib/validation/textbooks";
import { zh } from "@/lib/i18n/zh";

function revalidateTextbookPages() {
  revalidatePath("/teacher/textbooks");
  revalidatePath("/student/textbooks");
  revalidatePath("/owner/textbooks");
}

export async function updateTextbookAssignmentsAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const limit = await checkRateLimit("sensitive", teacher.id);
  if (!limit.success) throw new Error(zh.errors.tooManyOperations);
  const input = textbookAssignmentSchema.parse({
    textbookId: formData.get("textbookId"),
    studentIds: formData.getAll("studentIds"),
  });
  const studentIds = [...new Set(input.studentIds)];
  const textbook = await db.textbook.findFirst({
    where: { id: input.textbookId, uploadedById: teacher.id, archivedAt: null },
    select: { id: true },
  });
  if (!textbook) throw new AuthorizationError(zh.errors.resourceNotFound, 404);
  const relatedCount = await db.teacherStudent.count({
    where: {
      teacherId: teacher.id,
      studentId: { in: studentIds },
      student: {
        role: Role.STUDENT,
        status: UserStatus.ACTIVE,
        archivedAt: null,
      },
    },
  });
  if (relatedCount !== studentIds.length)
    throw new AuthorizationError(zh.errors.invalidStudentList, 403);

  await db.$transaction(async (tx) => {
    await tx.textbookAssignment.deleteMany({
      where: { textbookId: textbook.id },
    });
    if (studentIds.length) {
      await tx.textbookAssignment.createMany({
        data: studentIds.map((studentId) => ({
          textbookId: textbook.id,
          studentId,
          assignedById: teacher.id,
        })),
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: teacher.id,
        action: "TEXTBOOK_ASSIGNMENTS_UPDATED",
        entityType: "Textbook",
        entityId: textbook.id,
      },
    });
  });
  revalidateTextbookPages();
}

export async function deleteTextbookAction(formData: FormData) {
  const actor = await requireUser({ roles: [Role.OWNER, Role.TEACHER] });
  const limit = await checkRateLimit("sensitive", actor.id);
  if (!limit.success) throw new Error(zh.errors.tooManyOperations);
  const { textbookId } = textbookIdSchema.parse({
    textbookId: formData.get("textbookId"),
  });
  const textbook = await db.textbook.findFirst({
    where: {
      id: textbookId,
      archivedAt: null,
      ...(actor.role === Role.TEACHER ? { uploadedById: actor.id } : {}),
    },
    select: { id: true, storagePath: true },
  });
  if (!textbook) throw new AuthorizationError(zh.errors.resourceNotFound, 404);

  const archivedAt = new Date();
  await db.textbook.update({
    where: { id: textbook.id },
    data: { archivedAt },
  });
  try {
    await deletePrivateFile(textbook.storagePath);
  } catch (error) {
    await db.textbook.updateMany({
      where: { id: textbook.id, archivedAt },
      data: { archivedAt: null },
    });
    throw error;
  }
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      action: "TEXTBOOK_DELETED",
      entityType: "Textbook",
      entityId: textbook.id,
    },
  });
  revalidateTextbookPages();
}
