"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ExamStatus, GradingMode, QuestionType, Role } from "@/app/generated/prisma/enums";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { cloneExamVersion, defaultQuestion, getOwnedVersion, requireEditableVersion, versionPublicationResult } from "@/lib/exams/service";
import { normalizeAnswer } from "@/lib/exams/grading";
import { assignmentSchema, createExamSchema, questionInputSchema, reorderQuestionsSchema } from "@/lib/validation/exams";
import { zh } from "@/lib/i18n/zh";

export async function createExamAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const input = createExamSchema.parse({ title: formData.get("title"), description: formData.get("description") || undefined });
  const exam = await db.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: { ownerId: teacher.id, title: input.title, description: input.description, versions: { create: { versionNumber: 1, title: input.title } } },
      include: { versions: true },
    });
    await tx.auditLog.create({ data: { actorId: teacher.id, action: "EXAM_CREATED", entityType: "Exam", entityId: created.id } });
    return created;
  });
  redirect(`/teacher/exams/${exam.id}`);
}

export async function addQuestionAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const versionId = String(formData.get("versionId") ?? "");
  const version = await requireEditableVersion(teacher.id, versionId);
  const nextOrder = version.questions.length ? Math.max(...version.questions.map((q) => q.order)) + 1 : 0;
  await db.question.create({ data: { examVersionId: version.id, order: nextOrder, ...defaultQuestion } });
  revalidatePath(`/teacher/exams/${version.examId}`);
}

export async function updateQuestionAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const questionId = String(formData.get("questionId") ?? "");
  const existing = await db.question.findFirst({ where: { id: questionId, examVersion: { exam: { ownerId: teacher.id }, status: ExamStatus.DRAFT } }, include: { examVersion: true, passage: true } });
  if (!existing) throw new Error(zh.errors.editableQuestionNotFound);
  const input = questionInputSchema.parse({
    questionId,
    type: formData.get("type"),
    gradingMode: formData.get("gradingMode"),
    promptMd: formData.get("promptMd"),
    passageMd: formData.get("passageMd") ?? "",
    points: formData.get("points"),
    optionsText: formData.get("optionsText") ?? "",
    correctOptionKeys: formData.get("correctOptionKeys") ?? "",
    trueFalseAnswer: formData.get("trueFalseAnswer") ?? "",
    acceptableAnswers: formData.get("acceptableAnswers") ?? "",
    numericAnswer: formData.get("numericAnswer") ?? "",
    numericTolerance: formData.get("numericTolerance") ?? "",
    referenceAnswerMd: formData.get("referenceAnswerMd") ?? "",
    rubricMd: formData.get("rubricMd") ?? "",
    gradingNotesMd: formData.get("gradingNotesMd") ?? "",
    caseSensitive: formData.get("caseSensitive") === "on",
    trimWhitespace: formData.get("trimWhitespace") === "on",
    normalizePunctuation: formData.get("normalizePunctuation") === "on",
  });
  const gradingMode = input.type === "ESSAY" ? GradingMode.MANUAL : (input.gradingMode as GradingMode);
  const optionContents = input.optionsText.split("\n").map((line) => line.trim()).filter(Boolean);
  const correctKeys = new Set(input.correctOptionKeys.split(/[,，\s]+/).map((key) => key.trim().toUpperCase()).filter(Boolean));
  const acceptable = input.acceptableAnswers.split("\n").map((value) => value.trim()).filter(Boolean);

  await db.$transaction(async (tx) => {
    let passageId = existing.passageId;
    if (input.passageMd.trim()) {
      if (passageId) {
        await tx.passage.update({ where: { id: passageId }, data: { contentMd: input.passageMd.trim() } });
      } else {
        const maxPassage = await tx.passage.aggregate({ where: { examVersionId: existing.examVersionId }, _max: { order: true } });
        const passage = await tx.passage.create({ data: { examVersionId: existing.examVersionId, contentMd: input.passageMd.trim(), order: (maxPassage._max.order ?? -1) + 1 } });
        passageId = passage.id;
      }
    } else {
      passageId = null;
    }
    await tx.questionKey.deleteMany({ where: { questionId: existing.id } });
    await tx.questionOption.deleteMany({ where: { questionId: existing.id } });
    await tx.question.update({
      where: { id: existing.id },
      data: {
        type: input.type as QuestionType,
        gradingMode,
        passageId,
        promptMd: input.promptMd,
        points: input.points,
        caseSensitive: input.caseSensitive,
        trimWhitespace: input.trimWhitespace,
        normalizePunctuation: input.normalizePunctuation,
      },
    });
    const options: { id: string; optionKey: string }[] = [];
    for (const [order, contentMd] of optionContents.entries()) {
      const optionKey = String.fromCharCode(65 + order);
      options.push(await tx.questionOption.create({ data: { questionId: existing.id, optionKey, contentMd, order }, select: { id: true, optionKey: true } }));
    }
    const key = await tx.questionKey.create({
      data: {
        questionId: existing.id,
        trueFalseAnswer: input.trueFalseAnswer === "" ? null : input.trueFalseAnswer === "true",
        numericAnswer: input.numericAnswer === "" ? null : Number(input.numericAnswer),
        numericTolerance: input.numericTolerance === "" ? null : Number(input.numericTolerance),
        referenceAnswerMd: input.referenceAnswerMd || null,
        rubricMd: input.rubricMd || null,
        gradingNotesMd: input.gradingNotesMd || null,
        acceptableAnswers: { create: acceptable.map((value) => ({ value, normalizedValue: normalizeAnswer(value, input) })) },
      },
    });
    for (const option of options.filter((item) => correctKeys.has(item.optionKey))) {
      await tx.questionCorrectOption.create({ data: { questionKeyId: key.id, optionId: option.id } });
    }
    if (!passageId && existing.passageId) {
      const stillUsed = await tx.question.count({ where: { passageId: existing.passageId } });
      if (stillUsed === 0) await tx.passage.delete({ where: { id: existing.passageId } });
    }
  });
  revalidatePath(`/teacher/exams/${existing.examVersion.examId}`);
}

export async function deleteQuestionAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const questionId = String(formData.get("questionId") ?? "");
  const question = await db.question.findFirst({ where: { id: questionId, examVersion: { exam: { ownerId: teacher.id }, status: ExamStatus.DRAFT } }, include: { examVersion: true } });
  if (!question) throw new Error(zh.errors.editableQuestionNotFound);
  await db.question.delete({ where: { id: question.id } });
  revalidatePath(`/teacher/exams/${question.examVersion.examId}`);
}

export async function duplicateQuestionAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const questionId = String(formData.get("questionId") ?? "");
  const question = await db.question.findFirst({
    where: { id: questionId, examVersion: { exam: { ownerId: teacher.id }, status: ExamStatus.DRAFT } },
    include: { examVersion: true, options: true, key: { include: { acceptableAnswers: true, correctOptions: true } } },
  });
  if (!question) throw new Error(zh.errors.editableQuestionNotFound);
  const maxOrder = await db.question.aggregate({ where: { examVersionId: question.examVersionId }, _max: { order: true } });
  await db.$transaction(async (tx) => {
    const copy = await tx.question.create({ data: { examVersionId: question.examVersionId, passageId: question.passageId, type: question.type, gradingMode: question.gradingMode, promptMd: `${question.promptMd}${zh.defaults.copySuffix}`, order: (maxOrder._max.order ?? -1) + 1, points: question.points, caseSensitive: question.caseSensitive, trimWhitespace: question.trimWhitespace, normalizePunctuation: question.normalizePunctuation } });
    const optionMap = new Map<string, string>();
    for (const option of question.options) {
      const created = await tx.questionOption.create({ data: { questionId: copy.id, optionKey: option.optionKey, contentMd: option.contentMd, order: option.order } });
      optionMap.set(option.id, created.id);
    }
    if (question.key) {
      const key = await tx.questionKey.create({ data: { questionId: copy.id, trueFalseAnswer: question.key.trueFalseAnswer, numericAnswer: question.key.numericAnswer, numericTolerance: question.key.numericTolerance, referenceAnswerMd: question.key.referenceAnswerMd, rubricMd: question.key.rubricMd, gradingNotesMd: question.key.gradingNotesMd, acceptableAnswers: { create: question.key.acceptableAnswers.map((answer) => ({ value: answer.value, normalizedValue: answer.normalizedValue })) } } });
      for (const correct of question.key.correctOptions) {
        const optionId = optionMap.get(correct.optionId);
        if (optionId) await tx.questionCorrectOption.create({ data: { questionKeyId: key.id, optionId } });
      }
    }
  });
  revalidatePath(`/teacher/exams/${question.examVersion.examId}`);
}

export async function reorderQuestionsAction(input: unknown) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const parsed = reorderQuestionsSchema.parse(input);
  const version = await requireEditableVersion(teacher.id, parsed.versionId);
  const expected = new Set(version.questions.map((question) => question.id));
  if (parsed.orderedQuestionIds.length !== expected.size || parsed.orderedQuestionIds.some((id) => !expected.has(id))) throw new Error(zh.errors.invalidQuestionOrder);
  await db.$transaction(async (tx) => {
    for (const [index, id] of parsed.orderedQuestionIds.entries()) await tx.question.update({ where: { id }, data: { order: 10_000 + index } });
    for (const [index, id] of parsed.orderedQuestionIds.entries()) await tx.question.update({ where: { id }, data: { order: index } });
  });
  revalidatePath(`/teacher/exams/${version.examId}`);
}

export async function publishExamAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const versionId = String(formData.get("versionId") ?? "");
  const version = await requireEditableVersion(teacher.id, versionId);
  const result = versionPublicationResult(version);
  if (!result.valid) throw new Error(result.issues.map((issue) => issue.message).join("；"));
  const totalPoints = version.questions.reduce((sum, question) => sum + question.points.toNumber(), 0);
  await db.$transaction([
    db.examVersion.update({ where: { id: version.id }, data: { status: ExamStatus.ENABLED, totalPoints, publishedAt: new Date() } }),
    db.exam.update({ where: { id: version.examId }, data: { status: ExamStatus.ENABLED } }),
    db.auditLog.create({ data: { actorId: teacher.id, action: "EXAM_VERSION_ENABLED", entityType: "ExamVersion", entityId: version.id } }),
  ]);
  revalidatePath(`/teacher/exams/${version.examId}`);
}

export async function cloneExamVersionAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const versionId = String(formData.get("versionId") ?? "");
  const clone = await cloneExamVersion(teacher.id, versionId);
  redirect(`/teacher/exams/${clone.examId}?version=${clone.id}`);
}

export async function setExamStatusAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const versionId = String(formData.get("versionId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (status !== ExamStatus.DISABLED && status !== ExamStatus.ARCHIVED) throw new Error(zh.errors.invalidStatus);
  const version = await getOwnedVersion(teacher.id, versionId);
  await db.$transaction([
    db.examVersion.update({ where: { id: version.id }, data: { status: status as ExamStatus } }),
    db.exam.update({ where: { id: version.examId }, data: { status: status as ExamStatus, archivedAt: status === ExamStatus.ARCHIVED ? new Date() : undefined } }),
    db.auditLog.create({ data: { actorId: teacher.id, action: `EXAM_${status}`, entityType: "ExamVersion", entityId: version.id } }),
  ]);
  revalidatePath(`/teacher/exams/${version.examId}`);
}

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(zh.errors.invalidDate);
  return date;
}

export async function assignExamAction(formData: FormData) {
  const teacher = await requireUser({ roles: [Role.TEACHER] });
  const input = assignmentSchema.parse({
    versionId: formData.get("versionId"),
    studentIds: formData.getAll("studentIds"),
    availableFrom: formData.get("availableFrom") || undefined,
    dueAt: formData.get("dueAt") || undefined,
    maxAttempts: formData.get("maxAttempts") ?? "",
    timeLimitMinutes: formData.get("timeLimitMinutes") ?? "",
  });
  const version = await getOwnedVersion(teacher.id, input.versionId);
  if (version.status !== ExamStatus.ENABLED) throw new Error(zh.errors.enabledAssignmentOnly);
  const profiles = await db.studentProfile.findMany({ where: { id: { in: input.studentIds }, user: { studentTeachers: { some: { teacherId: teacher.id } } } }, select: { id: true } });
  if (profiles.length !== input.studentIds.length) throw new Error(zh.errors.invalidStudentList);
  const availableFrom = parseDate(input.availableFrom);
  const dueAt = parseDate(input.dueAt);
  if (availableFrom && dueAt && dueAt <= availableFrom) throw new Error(zh.errors.dueAfterStart);
  await db.$transaction(async (tx) => {
    for (const profile of profiles) {
      await tx.assignment.upsert({
        where: { examVersionId_studentProfileId: { examVersionId: version.id, studentProfileId: profile.id } },
        update: { availableFrom, dueAt, maxAttempts: input.maxAttempts === "" ? null : input.maxAttempts, timeLimitMinutes: input.timeLimitMinutes === "" ? null : input.timeLimitMinutes, assignedById: teacher.id },
        create: { examVersionId: version.id, studentProfileId: profile.id, assignedById: teacher.id, availableFrom, dueAt, maxAttempts: input.maxAttempts === "" ? null : input.maxAttempts, timeLimitMinutes: input.timeLimitMinutes === "" ? null : input.timeLimitMinutes },
      });
    }
    await tx.auditLog.create({ data: { actorId: teacher.id, action: "EXAM_ASSIGNED", entityType: "ExamVersion", entityId: version.id, metadata: { studentCount: profiles.length } } });
  });
  revalidatePath(`/teacher/exams/${version.examId}`);
}
