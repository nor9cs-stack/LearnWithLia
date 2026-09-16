import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Role } from "@/app/generated/prisma/enums";
import { AuthorizationError, requireUser } from "@/lib/auth/dal";
import { requireEditableVersion } from "@/lib/exams/service";
import { validateExamFileContent } from "@/lib/imports/file-validation";
import { inngest } from "@/lib/inngest/client";
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { assertTrustedOrigin } from "@/lib/security/origin";
import { uploadPrivateExamFile } from "@/lib/storage/supabase";
import { zh } from "@/lib/i18n/zh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ versionId: string }> }) {
  try {
    assertTrustedOrigin(request);
    const teacher = await requireUser({ roles: [Role.TEACHER] });
    const limit = await checkRateLimit("upload", teacher.id);
    if (!limit.success) return NextResponse.json({ message: zh.errors.uploadTooFrequent }, { status: 429 });
    const { versionId } = await params;
    const version = await requireEditableVersion(teacher.id, versionId);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ message: zh.errors.chooseFile }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const validated = await validateExamFileContent({ name: file.name, declaredMime: file.type, bytes });
    const storagePath = `${teacher.id}/${version.examId}/${version.id}/${randomUUID()}.${validated.fileType.toLowerCase()}`;
    await uploadPrivateExamFile(storagePath, bytes, validated.detectedMime);
    const uploaded = await db.uploadedFile.create({
      data: {
        examVersionId: version.id,
        uploadedById: teacher.id,
        originalName: file.name.slice(0, 255),
        storagePath,
        declaredMime: file.type,
        detectedMime: validated.detectedMime,
        fileType: validated.fileType,
        sizeBytes: bytes.byteLength,
        sha256: validated.sha256,
        importStatus: "QUEUED",
      },
    });
    await inngest.send({ name: "exam/import.requested", data: { uploadedFileId: uploaded.id } });
    return NextResponse.json({ id: uploaded.id, status: uploaded.importStatus }, { status: 202 });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 400;
    return NextResponse.json({ message: status === 400 ? zh.errors.invalidUpload : error instanceof Error ? error.message : zh.errors.uploadFailed }, { status });
  }
}
