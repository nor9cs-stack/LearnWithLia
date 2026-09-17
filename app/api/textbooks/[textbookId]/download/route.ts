import { NextResponse } from "next/server";
import { Role } from "@/app/generated/prisma/enums";
import { AuthorizationError, requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { downloadPrivateFile } from "@/lib/storage/supabase";
import {
  textbookDownloadModeSchema,
  textbookIdSchema,
} from "@/lib/validation/textbooks";
import { zh } from "@/lib/i18n/zh";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ textbookId: string }> },
) {
  try {
    const user = await requireUser({
      roles: [Role.OWNER, Role.TEACHER, Role.STUDENT],
    });
    const { textbookId } = textbookIdSchema.parse(await params);
    const textbook = await db.textbook.findFirst({
      where: {
        id: textbookId,
        archivedAt: null,
        ...(user.role === Role.TEACHER
          ? { uploadedById: user.id }
          : user.role === Role.STUDENT
            ? { assignments: { some: { studentId: user.id } } }
            : {}),
      },
      select: { storagePath: true, originalName: true },
    });
    if (!textbook)
      throw new AuthorizationError(zh.errors.resourceNotFound, 404);
    const bytes = await downloadPrivateFile(textbook.storagePath);
    const downloadMode = textbookDownloadModeSchema.parse(
      new URL(request.url).searchParams.get("download") ?? "0",
    );
    const disposition = downloadMode === "1" ? "attachment" : "inline";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${disposition}; filename="textbook.pdf"; filename*=UTF-8''${encodeURIComponent(textbook.originalName)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "sandbox; default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 404;
    return NextResponse.json(
      { message: zh.errors.resourceNotFound },
      { status },
    );
  }
}
