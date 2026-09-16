import "dotenv/config";

import { hash } from "@node-rs/argon2";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";
import {
  AttemptStatus,
  ExamStatus,
  GradingMode,
  QuestionType,
  Role,
  UserStatus,
} from "../app/generated/prisma/enums";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("SEED 需要 DIRECT_URL 或 DATABASE_URL");

const passwords = {
  owner: process.env.SEED_OWNER_PASSWORD,
  teacher: process.env.SEED_TEACHER_PASSWORD,
  student: process.env.SEED_STUDENT_PASSWORD,
};
if (!passwords.owner || !passwords.teacher || !passwords.student) {
  throw new Error("请通过环境变量提供三个 SEED_*_PASSWORD；种子脚本不会使用或打印默认密码");
}

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
const passwordOptions = {
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
} as const;

async function ensureStudent(
  studentNumber: string,
  name: string,
  passwordHash: string,
  teacherId: string,
) {
  const normalized = studentNumber.toLowerCase();
  const existing = await db.studentProfile.findUnique({
    where: { studentNumberNormalized: normalized },
  });
  const student = existing
    ? await db.user.update({
        where: { id: existing.userId },
        data: {
          name,
          passwordHash,
          status: UserStatus.ACTIVE,
          archivedAt: null,
          mustChangePassword: false,
        },
      })
    : await db.user.create({
        data: {
          role: Role.STUDENT,
          name,
          passwordHash,
          mustChangePassword: false,
          studentProfile: {
            create: { studentNumber, studentNumberNormalized: normalized },
          },
        },
      });
  await db.teacherStudent.upsert({
    where: { teacherId_studentId: { teacherId, studentId: student.id } },
    create: { teacherId, studentId: student.id },
    update: {},
  });
  return student;
}

try {
  const [ownerHash, teacherHash, studentHash] = await Promise.all([
    hash(passwords.owner, passwordOptions),
    hash(passwords.teacher, passwordOptions),
    hash(passwords.student, passwordOptions),
  ]);
  const owner = await db.user.upsert({
    where: { emailNormalized: "owner@learnwithlia.local" },
    create: {
      role: Role.OWNER,
      name: "平台负责人",
      email: "owner@learnwithlia.local",
      emailNormalized: "owner@learnwithlia.local",
      passwordHash: ownerHash,
      mustChangePassword: false,
    },
    update: { passwordHash: ownerHash, status: UserStatus.ACTIVE, archivedAt: null },
  });
  const teacher = await db.user.upsert({
    where: { emailNormalized: "lia@learnwithlia.local" },
    create: {
      role: Role.TEACHER,
      name: "Lia 老师",
      email: "lia@learnwithlia.local",
      emailNormalized: "lia@learnwithlia.local",
      passwordHash: teacherHash,
      mustChangePassword: false,
    },
    update: { passwordHash: teacherHash, status: UserStatus.ACTIVE, archivedAt: null },
  });
  const [studentOne, studentTwo] = await Promise.all([
    ensureStudent("STUDENT001", "示例学生一", studentHash, teacher.id),
    ensureStudent("STUDENT002", "示例学生二", studentHash, teacher.id),
  ]);

  const existingExam = await db.exam.findFirst({
    where: { ownerId: teacher.id, title: "综合英语能力（示例）" },
  });
  if (!existingExam) {
    const exam = await db.exam.create({
      data: {
        ownerId: teacher.id,
        title: "综合英语能力（示例）",
        description: "包含全部六种题型、两名虚构学生与同一学生的多次历史作答。",
        versions: {
          create: {
            versionNumber: 1,
            title: "综合英语能力（示例）",
            instructionsMd: "请认真阅读题目。每次作答限时 30 分钟，系统自动保存答案。",
          },
        },
      },
      include: { versions: true },
    });
    const version = exam.versions[0]!;

    const single = await db.question.create({
      data: {
        examVersionId: version.id,
        type: QuestionType.SINGLE_CHOICE,
        gradingMode: GradingMode.AUTO,
        promptMd: "Choose the word closest in meaning to **happy**.",
        order: 0,
        points: 2,
        options: {
          create: [
            { optionKey: "A", contentMd: "joyful", order: 0 },
            { optionKey: "B", contentMd: "silent", order: 1 },
            { optionKey: "C", contentMd: "difficult", order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    const singleCorrect = single.options.find((option) => option.optionKey === "A")!;
    await db.questionKey.create({
      data: { questionId: single.id, correctOptions: { create: { optionId: singleCorrect.id } } },
    });

    const multiple = await db.question.create({
      data: {
        examVersionId: version.id,
        type: QuestionType.MULTIPLE_CHOICE,
        gradingMode: GradingMode.AUTO,
        promptMd: "Select all **colors**.",
        order: 1,
        points: 2,
        options: {
          create: [
            { optionKey: "A", contentMd: "purple", order: 0 },
            { optionKey: "B", contentMd: "table", order: 1 },
            { optionKey: "C", contentMd: "white", order: 2 },
          ],
        },
      },
      include: { options: true },
    });
    const multipleCorrect = multiple.options.filter((option) => ["A", "C"].includes(option.optionKey));
    await db.questionKey.create({
      data: {
        questionId: multiple.id,
        correctOptions: { create: multipleCorrect.map((option) => ({ optionId: option.id })) },
      },
    });

    const trueFalse = await db.question.create({
      data: {
        examVersionId: version.id,
        type: QuestionType.TRUE_FALSE,
        gradingMode: GradingMode.AUTO,
        promptMd: "The word **progress** can describe improvement over time.",
        order: 2,
        points: 2,
        key: { create: { trueFalseAnswer: true } },
      },
    });
    const fillBlank = await db.question.create({
      data: {
        examVersionId: version.id,
        type: QuestionType.FILL_BLANK,
        gradingMode: GradingMode.AUTO,
        promptMd: "Complete: Practice makes _____.",
        order: 3,
        points: 2,
        normalizePunctuation: true,
        key: {
          create: {
            acceptableAnswers: {
              create: [
                { value: "perfect", normalizedValue: "perfect" },
                { value: "perfection", normalizedValue: "perfection" },
              ],
            },
          },
        },
      },
    });
    const shortAnswer = await db.question.create({
      data: {
        examVersionId: version.id,
        type: QuestionType.SHORT_ANSWER,
        gradingMode: GradingMode.AUTO,
        promptMd: "Round π to two decimal places.",
        order: 4,
        points: 2,
        key: { create: { numericAnswer: 3.14, numericTolerance: 0.01 } },
      },
    });
    const essay = await db.question.create({
      data: {
        examVersionId: version.id,
        type: QuestionType.ESSAY,
        gradingMode: GradingMode.MANUAL,
        promptMd: "Write a short paragraph about how you learn from mistakes.",
        order: 5,
        points: 2,
        key: {
          create: {
            referenceAnswerMd: "A clear paragraph should state a lesson and support it with an example.",
            rubricMd: "Clarity 1 point; relevant supporting example 1 point.",
          },
        },
      },
    });

    await db.examVersion.update({
      where: { id: version.id },
      data: { status: ExamStatus.ENABLED, totalPoints: 12, publishedAt: new Date() },
    });
    await db.exam.update({ where: { id: exam.id }, data: { status: ExamStatus.ENABLED } });

    const profiles = await db.studentProfile.findMany({
      where: { userId: { in: [studentOne.id, studentTwo.id] } },
    });
    const assignments = await Promise.all(
      profiles.map((profile) =>
        db.assignment.create({
          data: {
            examVersionId: version.id,
            studentProfileId: profile.id,
            assignedById: teacher.id,
            maxAttempts: null,
            timeLimitMinutes: 30,
          },
        }),
      ),
    );
    const firstAssignment = assignments.find((item) => {
      const profile = profiles.find((candidate) => candidate.id === item.studentProfileId);
      return profile?.userId === studentOne.id;
    })!;

    const firstAttempt = await db.attempt.create({
      data: {
        assignmentId: firstAssignment.id,
        examVersionId: version.id,
        studentId: studentOne.id,
        attemptNumber: 1,
        status: AttemptStatus.GRADED,
        startedAt: new Date("2026-01-10T14:00:00.000Z"),
        submittedAt: new Date("2026-01-10T14:20:00.000Z"),
        gradedAt: new Date("2026-01-10T16:00:00.000Z"),
        autoCorrectCount: 4,
        autoQuestionCount: 5,
        autoScore: 8,
        pendingManualCount: 0,
        finalScore: 9.5,
      },
    });
    await db.response.createMany({
      data: [
        { attemptId: firstAttempt.id, questionId: single.id, autoCorrect: true, autoScore: 2 },
        { attemptId: firstAttempt.id, questionId: multiple.id, autoCorrect: false, autoScore: 0 },
        { attemptId: firstAttempt.id, questionId: trueFalse.id, booleanAnswer: true, autoCorrect: true, autoScore: 2 },
        { attemptId: firstAttempt.id, questionId: fillBlank.id, textAnswer: "perfect", autoCorrect: true, autoScore: 2 },
        { attemptId: firstAttempt.id, questionId: shortAnswer.id, numericAnswer: 3.14, autoCorrect: true, autoScore: 2 },
        { attemptId: firstAttempt.id, questionId: essay.id, textAnswer: "Mistakes help me notice what to practice next." },
      ],
    });
    const essayResponse = await db.response.findUniqueOrThrow({
      where: { attemptId_questionId: { attemptId: firstAttempt.id, questionId: essay.id } },
    });
    await db.manualGrade.create({
      data: {
        responseId: essayResponse.id,
        graderId: teacher.id,
        score: 1.5,
        feedbackMd: "观点清楚；可以再补充一个更具体的例子。",
        gradedAt: new Date("2026-01-10T16:00:00.000Z"),
      },
    });
    await db.unknownWord.create({
      data: {
        attemptId: firstAttempt.id,
        questionId: essay.id,
        exactText: "supporting example",
        prefix: "with an ",
        suffix: ".",
        occurrence: 0,
      },
    });

    const secondAttempt = await db.attempt.create({
      data: {
        assignmentId: firstAssignment.id,
        examVersionId: version.id,
        studentId: studentOne.id,
        attemptNumber: 2,
        status: AttemptStatus.PENDING_REVIEW,
        startedAt: new Date("2026-01-17T14:00:00.000Z"),
        submittedAt: new Date("2026-01-17T14:18:00.000Z"),
        autoCorrectCount: 5,
        autoQuestionCount: 5,
        autoScore: 10,
        pendingManualCount: 1,
      },
    });
    await db.response.createMany({
      data: [
        { attemptId: secondAttempt.id, questionId: single.id, autoCorrect: true, autoScore: 2 },
        { attemptId: secondAttempt.id, questionId: multiple.id, autoCorrect: true, autoScore: 2 },
        { attemptId: secondAttempt.id, questionId: trueFalse.id, booleanAnswer: true, autoCorrect: true, autoScore: 2 },
        { attemptId: secondAttempt.id, questionId: fillBlank.id, textAnswer: "perfect", autoCorrect: true, autoScore: 2 },
        { attemptId: secondAttempt.id, questionId: shortAnswer.id, numericAnswer: 3.14, autoCorrect: true, autoScore: 2 },
        { attemptId: secondAttempt.id, questionId: essay.id, textAnswer: "I review each mistake and make a small plan to improve." },
      ],
    });
  }

  await db.auditLog.create({
    data: {
      actorId: owner.id,
      action: "DEVELOPMENT_SEED_COMPLETED",
      entityType: "System",
      entityId: "seed",
    },
  });
  process.stdout.write("种子数据已就绪：1 位 OWNER、1 位老师、2 位学生、全部题型和多次作答记录。\n");
} finally {
  await db.$disconnect();
}
