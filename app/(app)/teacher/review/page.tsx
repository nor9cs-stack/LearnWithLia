import { AttemptStatus, Role } from "@/app/generated/prisma/enums";
import { z } from "zod";
import {
  ReviewList,
  type ReviewAttemptDto,
} from "@/components/grading/review-list";
import { Button } from "@/components/ui/button";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { markdownToPlainText } from "@/lib/markdown";
import { zh } from "@/lib/i18n/zh";

const reviewFilterSchema = z.object({
  student: z.string().cuid().optional(),
  exam: z.string().cuid().optional(),
});

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; exam?: string }>;
}) {
  const teacher = await requirePageUser([Role.TEACHER]);
  const parsedFilters = reviewFilterSchema.safeParse(await searchParams);
  const filters = parsedFilters.success ? parsedFilters.data : {};
  const attempts = await db.attempt.findMany({
    where: {
      examVersion: {
        exam: {
          ownerId: teacher.id,
          ...(filters.exam ? { id: filters.exam } : {}),
        },
      },
      student: {
        studentTeachers: { some: { teacherId: teacher.id } },
        ...(filters.student ? { id: filters.student } : {}),
      },
      status: {
        in: [
          AttemptStatus.SUBMITTED,
          AttemptStatus.PENDING_REVIEW,
          AttemptStatus.GRADED,
        ],
      },
    },
    orderBy: { submittedAt: "desc" },
    include: {
      student: { include: { studentProfile: true } },
      examVersion: { include: { exam: true } },
      responses: {
        orderBy: { question: { order: "asc" } },
        include: {
          question: {
            include: { key: { include: { acceptableAnswers: true } } },
          },
          selected: { include: { option: true } },
          manualGrade: true,
        },
      },
      unknownWords: { include: { question: true } },
    },
  });
  const [students, exams] = await Promise.all([
    db.user.findMany({
      where: {
        role: Role.STUDENT,
        studentTeachers: { some: { teacherId: teacher.id } },
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.exam.findMany({
      where: { ownerId: teacher.id },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  const dto: ReviewAttemptDto[] = attempts.map((attempt) => ({
    id: attempt.id,
    isGraded: attempt.status === AttemptStatus.GRADED,
    attemptLabel: zh.common.attempt(attempt.attemptNumber),
    submittedAt: attempt.submittedAt?.toLocaleString("zh-CN") ?? "—",
    studentName: attempt.student.name,
    examTitle: attempt.examVersion.exam.title,
    summary: zh.review.summary(
      attempt.autoCorrectCount ?? 0,
      attempt.autoQuestionCount ?? 0,
      attempt.finalScore?.toString() ?? zh.common.pending,
    ),
    attemptFeedback: attempt.teacherFeedbackMd ?? "",
    responses: attempt.responses.map((response) => {
      const selectedAnswer = response.selected
        .map((item) => item.option.contentMd)
        .join("、");
      const answer =
        (response.textAnswer ??
          response.numericAnswer?.toString() ??
          selectedAnswer) ||
        (response.booleanAnswer == null
          ? zh.common.notAnswered
          : response.booleanAnswer
            ? zh.common.correct
            : zh.common.incorrect);
      const reference =
        response.question.key?.acceptableAnswers
          .map((item) => item.value)
          .join(" / ") ||
        response.question.key?.referenceAnswerMd ||
        response.question.key?.rubricMd ||
        response.question.key?.gradingNotesMd ||
        zh.common.none;
      return {
        id: response.id,
        prompt: markdownToPlainText(response.question.promptMd),
        studentAnswer: answer,
        reference,
        points: response.question.points.toString(),
        gradingMode: response.question.gradingMode,
        completed:
          response.question.gradingMode === "AUTO"
            ? response.autoScore !== null || response.autoCorrect !== null
            : response.manualGrade !== null,
        autoCorrect: response.autoCorrect,
        score:
          response.question.gradingMode === "AUTO"
            ? (response.autoScore?.toString() ?? "")
            : (response.manualGrade?.score.toString() ?? ""),
        feedback: response.manualGrade?.feedbackMd ?? "",
      };
    }),
    unknownWords: attempt.unknownWords.map((word) => ({
      id: word.id,
      text: word.exactText,
      questionLabel: zh.common.question(word.question.order + 1),
    })),
  }));

  return (
    <main className="content-page">
      <header className="page-heading">
        <div>
          <p className="page-kicker">{zh.review.kicker}</p>
          <h1>{zh.review.title}</h1>
          <p>{zh.review.description}</p>
        </div>
      </header>
      <form className="filter-bar">
        <label>
          {zh.review.student}
          <select name="student" defaultValue={filters.student ?? ""}>
            <option value="">{zh.review.allStudents}</option>
            {students.map((student) => (
              <option value={student.id} key={student.id}>
                {student.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {zh.review.exam}
          <select name="exam" defaultValue={filters.exam ?? ""}>
            <option value="">{zh.review.allExams}</option>
            {exams.map((exam) => (
              <option value={exam.id} key={exam.id}>
                {exam.title}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="outline">
          {zh.review.filter}
        </Button>
      </form>
      <ReviewList attempts={dto} />
    </main>
  );
}
