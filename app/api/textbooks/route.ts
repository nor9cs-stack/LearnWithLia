import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Role, UserStatus } from "@/app/generated/prisma/enums";
import { AuthorizationError, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { validateTextbookPdfContent } from "@/lib/imports/file-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin } from "@/lib/security/origin";
import {
  deletePrivateFile,
  uploadPrivateExamFile,
} from "@/lib/storage/supabase";
import {
  sanitizePdfFileName,
  textbookMetadataSchema,
} from "@/lib/validation/textbooks";
import { zh } from "@/lib/i18n/zh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let uploadedPath: string | null = null;
  try {
    assertTrustedOrigin(request);
    const teacher = await requireUser({ roles: [Role.TEACHER] });
    const limit = await checkRateLimit("upload", teacher.id);
    if (!limit.success)
      return NextResponse.json(
        { message: zh.errors.uploadTooFrequent },
        { status: 429 },
      );

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File))
      return NextResponse.json(
        { message: zh.errors.chooseFile },
        { status: 400 },
      );
    const input = textbookMetadataSchema.parse({
      title: form.get("title"),
      description: form.get("description") || undefined,
      studentIds: form.getAll("studentIds"),
    });
    const studentIds = [...new Set(input.studentIds)];
    if (studentIds.length) {
      const relatedStudents = await db.teacherStudent.count({
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
      if (relatedStudents !== studentIds.length)
        throw new AuthorizationError(zh.errors.invalidStudentList, 403);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = await validateTextbookPdfContent({
      name: file.name,
      declaredMime: file.type,
      bytes,
    });
    uploadedPath = `textbooks/${teacher.id}/${randomUUID()}.pdf`;
    await uploadPrivateExamFile(uploadedPath, bytes, validated.detectedMime);

    const textbook = await db.$transaction(async (tx) => {
      const created = await tx.textbook.create({
        data: {
          uploadedById: teacher.id,
          title: input.title,
          description: input.description || null,
          originalName: sanitizePdfFileName(file.name),
          storagePath: uploadedPath!,
          declaredMime: file.type,
          detectedMime: validated.detectedMime,
          sizeBytes: bytes.byteLength,
          sha256: validated.sha256,
          assignments: {
            create: studentIds.map((studentId) => ({
              studentId,
              assignedById: teacher.id,
            })),
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: teacher.id,
          action: "TEXTBOOK_UPLOADED",
          entityType: "Textbook",
          entityId: created.id,
        },
      });
      return created;
    });
    uploadedPath = null;
    return NextResponse.json({ id: textbook.id }, { status: 201 });
  } catch (error) {
    if (uploadedPath) {
      try {
        await deletePrivateFile(uploadedPath);
      } catch {
        console.error("TEXTBOOK_UPLOAD_ROLLBACK_FAILED");
      }
    }
    const status = error instanceof AuthorizationError ? error.status : 400;
    return NextResponse.json(
      {
        message:
          status === 400
            ? zh.errors.invalidUpload
            : error instanceof Error
              ? error.message
              : zh.errors.uploadFailed,
      },
      { status },
    );
  }
}
