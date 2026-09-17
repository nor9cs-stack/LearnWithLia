import { z } from "zod";
import { AttemptStatus, ExamStatus, ImportStatus, SubmissionReason } from "@/app/generated/prisma/enums";
import { db } from "@/lib/db";
import { submitAttempt } from "@/lib/exams/submission";
import { extractExamText } from "@/lib/imports/extract";
import { parseDraftQuestions } from "@/lib/imports/parse-draft";
import { inngest } from "@/lib/inngest/client";
import { createExamFileSignedUrl } from "@/lib/storage/supabase";
import { zh } from "@/lib/i18n/zh";

const importEventSchema = z.object({ uploadedFileId: z.string().cuid() });

export const processExamImport = inngest.createFunction(
  {
    id: "process-exam-import",
    name: "Process exam source file",
    retries: 3,
    triggers: { event: "exam/import.requested" },
    idempotency: "event.data.uploadedFileId",
  },
  async ({ event, step }) => {
    const { uploadedFileId } = importEventSchema.parse(event.data);
    const file = await step.run("load-file-record", async () => {
      const record = await db.uploadedFile.findUnique({ where: { id: uploadedFileId }, include: { examVersion: true } });
      if (!record) throw new Error("FILE_RECORD_NOT_FOUND");
      if (record.examVersion.status !== ExamStatus.DRAFT) throw new Error("VERSION_NOT_EDITABLE");
      await db.uploadedFile.update({ where: { id: record.id }, data: { importStatus: ImportStatus.PROCESSING, importErrorCode: null, importMessage: null } });
      return record;
    });
    const signedUrl = await step.run("sign-private-file", () => createExamFileSignedUrl(file.storagePath));
    const extraction = await step.run("download-and-extract-text", async () => {
      const response = await fetch(signedUrl, { cache: "no-store" });
      if (!response.ok) throw new Error("PRIVATE_DOWNLOAD_FAILED");
      const bytes = new Uint8Array(await response.arrayBuffer());
      return extractExamText(bytes, file.fileType);
    });
    if (extraction.status === "OCR_REQUIRED") {
      await db.uploadedFile.update({ where: { id: file.id }, data: { importStatus: ImportStatus.OCR_REQUIRED, importErrorCode: "OCR_REQUIRED", importMessage: zh.imports.ocrRequired } });
      return { status: "OCR_REQUIRED" };
    }
    if (extraction.status === "FAILED") {
      await db.uploadedFile.update({ where: { id: file.id }, data: { importStatus: ImportStatus.FAILED, importErrorCode: extraction.code, importMessage: extraction.message } });
      return { status: "FAILED", code: extraction.code };
    }
    const parsed = await step.run("parse-draft-questions", () => parseDraftQuestions(extraction.text));
    await step.run("save-draft", async () => {
      const max = await db.question.aggregate({ where: { examVersionId: file.examVersionId }, _max: { order: true } });
      await db.$transaction(async (tx) => {
        for (const [index, question] of parsed.entries()) {
          await tx.question.create({
            data: {
              examVersionId: file.examVersionId,
              type: question.type,
              gradingMode: question.gradingMode,
              promptMd: question.promptMd,
              order: (max._max.order ?? -1) + index + 1,
              points: 1,
              options: { create: question.options.map((contentMd, order) => ({ optionKey: String.fromCharCode(65 + order), contentMd, order })) },
            },
          });
        }
        await tx.uploadedFile.update({ where: { id: file.id }, data: { importStatus: ImportStatus.READY_FOR_REVIEW, extractedText: extraction.text, importMessage: zh.imports.draftReady(parsed.length) } });
      });
    });
    return { status: "READY_FOR_REVIEW", questionCount: parsed.length };
  },
);

export const submitExpiredAttempts = inngest.createFunction(
  {
    id: "submit-expired-attempts",
    name: "Submit expired timed attempts",
    retries: 2,
    triggers: { cron: "*/1 * * * *" },
  },
  async ({ step }) => {
    const expired = await step.run("find-expired-attempts", () =>
      db.attempt.findMany({
        where: {
          status: AttemptStatus.IN_PROGRESS,
          expiresAt: { lte: new Date() },
        },
        select: { id: true, studentId: true },
        orderBy: { expiresAt: "asc" },
        take: 100,
      }),
    );

    for (const attempt of expired) {
      await step.run(`submit-${attempt.id}`, () =>
        submitAttempt(attempt.id, attempt.studentId, SubmissionReason.TIME_EXPIRED),
      );
    }

    return { submitted: expired.length };
  },
);
