import Link from "next/link";
import { Clock3, History, Play } from "lucide-react";
import { z } from "zod";
import {
  AttemptStatus,
  ExamStatus,
  Role,
} from "@/app/generated/prisma/enums";
import { startAttemptAction } from "@/app/actions/attempts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { evaluateAttemptEligibility } from "@/lib/exams/attempt-timing";
import { createAttemptHistoryDisplay } from "@/lib/exams/history";
import { zh } from "@/lib/i18n/zh";

const HISTORY_PAGE_SIZE = 10;
const historyPageSchema = z.coerce.number().int().min(1).catch(1);

export default async function StudentExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ historyPage?: string }>;
}) {
  const student = await requirePageUser([Role.STUDENT]);
  if (!student.studentProfile) throw new Error(zh.errors.resourceNotFound);
  const filters = await searchParams;
  const historyPage = historyPageSchema.parse(filters.historyPage);
  const historyWhere = {
    studentId: student.id,
    status: {
      in: [
        AttemptStatus.SUBMITTED,
        AttemptStatus.PENDING_REVIEW,
        AttemptStatus.GRADED,
      ],
    },
  };
  const [assignments, history, historyCount] = await Promise.all([
    db.assignment.findMany({
      where: { studentProfileId: student.studentProfile.id },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      include: {
        examVersion: { include: { _count: { select: { questions: true } } } },
        attempts: { orderBy: { attemptNumber: "desc" } },
      },
    }),
    db.attempt.findMany({
      where: historyWhere,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip: (historyPage - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
      include: { examVersion: { select: { title: true, totalPoints: true } } },
    }),
    db.attempt.count({ where: historyWhere }),
  ]);
  const now = new Date();
  const activeAssignments = assignments.filter((assignment) => {
    if (
      assignment.attempts.some(
        (attempt) => attempt.status === AttemptStatus.IN_PROGRESS,
      )
    )
      return true;
    return evaluateAttemptEligibility({
      now,
      examEnabled: assignment.examVersion.status === ExamStatus.ENABLED,
      availableFrom: assignment.availableFrom,
      dueAt: assignment.dueAt,
      maxAttempts: assignment.maxAttempts,
      completedAttemptCount: assignment.attempts.length,
      timeLimitMinutes: assignment.timeLimitMinutes,
    }).allowed;
  });
  const totalHistoryPages = Math.max(
    1,
    Math.ceil(historyCount / HISTORY_PAGE_SIZE),
  );

  return (
    <main className="content-page">
      <header className="page-heading">
        <div>
          <p className="page-kicker">{zh.studentExams.kicker}</p>
          <h1>{zh.studentExams.title}</h1>
          <p>{zh.studentExams.description}</p>
        </div>
      </header>
      <section className="student-exam-section">
        <div className="section-title">
          <h2>{zh.studentExams.activeTitle}</h2>
        </div>
        <div className="student-exam-grid">
          {activeAssignments.map((assignment) => {
            const inProgress = assignment.attempts.find(
              (attempt) => attempt.status === AttemptStatus.IN_PROGRESS,
            );
            const completedCount = assignment.attempts.filter(
              (attempt) => attempt.status !== AttemptStatus.IN_PROGRESS,
            ).length;
            return (
              <Card key={assignment.id}>
                <CardHeader>
                  <div className="card-title-row">
                    <Badge variant={inProgress ? "default" : "secondary"}>
                      {inProgress
                        ? zh.statuses.IN_PROGRESS
                        : zh.studentExams.available}
                    </Badge>
                    <span>
                      {zh.exams.questionCount(
                        assignment.examVersion._count.questions,
                      )}
                    </span>
                  </div>
                  <CardTitle>{assignment.examVersion.title}</CardTitle>
                  <CardDescription>
                    {assignment.dueAt
                      ? zh.studentExams.due(
                          assignment.dueAt.toLocaleString("zh-CN"),
                        )
                      : zh.common.noDueDate}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="assignment-meta">
                    <span>
                      <Clock3 />{" "}
                      {assignment.timeLimitMinutes
                        ? zh.studentExams.minutes(assignment.timeLimitMinutes)
                        : zh.common.untimed}
                    </span>
                    <span>
                      <History />{" "}
                      {zh.studentExams.completed(
                        completedCount,
                        assignment.maxAttempts,
                      )}
                    </span>
                  </div>
                  {inProgress ? (
                    <Button asChild className="w-full">
                      <Link href={`/student/attempts/${inProgress.id}`}>
                        <Play />
                        {zh.studentExams.continue}
                      </Link>
                    </Button>
                  ) : (
                    <form action={startAttemptAction}>
                      <input
                        type="hidden"
                        name="assignmentId"
                        value={assignment.id}
                      />
                      <Button className="w-full" type="submit">
                        <Play />
                        {zh.studentExams.start}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {activeAssignments.length === 0 ? (
            <div className="empty-state">{zh.studentExams.empty}</div>
          ) : null}
        </div>
      </section>

      <section className="student-exam-section">
        <div className="section-title">
          <h2>{zh.studentExams.historyTitle}</h2>
        </div>
        <div className="history-list">
          {history.map((attempt) => {
            const display = createAttemptHistoryDisplay({
              status: attempt.status,
              submissionReason: attempt.submissionReason,
              autoCorrectCount: attempt.autoCorrectCount,
              autoQuestionCount: attempt.autoQuestionCount,
              pendingManualCount: attempt.pendingManualCount,
              finalScore: attempt.finalScore?.toString() ?? null,
              totalPoints: attempt.examVersion.totalPoints.toString(),
            });
            return (
              <Link
                className="history-record"
                href={`/student/attempts/${attempt.id}`}
                key={attempt.id}
              >
                <div className="history-record-head">
                  <div>
                    <strong>{attempt.examVersion.title}</strong>
                    <span>{zh.common.attempt(attempt.attemptNumber)}</span>
                  </div>
                  <div className="row-actions">
                    <Badge
                      variant={
                        attempt.status === AttemptStatus.GRADED
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {display.statusLabel}
                    </Badge>
                    {display.expired ? (
                      <Badge variant="outline">
                        {zh.studentExams.expiredSubmission}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="history-record-meta">
                  <span>
                    {zh.studentExams.startedAt(
                      attempt.startedAt.toLocaleString("zh-CN"),
                    )}
                  </span>
                  <span>
                    {zh.studentExams.submittedAt(
                      attempt.submittedAt?.toLocaleString("zh-CN") ?? "—",
                    )}
                  </span>
                  <span>
                    {display.autoResult}
                  </span>
                  <span>{display.finalResult}</span>
                </div>
              </Link>
            );
          })}
          {history.length === 0 ? (
            <div className="empty-state">{zh.studentExams.historyEmpty}</div>
          ) : null}
        </div>
        {historyCount > HISTORY_PAGE_SIZE ? (
          <nav className="pagination" aria-label={zh.studentExams.historyTitle}>
            {historyPage > 1 ? (
              <Button asChild variant="outline">
                <Link href={`/student/exams?historyPage=${historyPage - 1}`}>
                  {zh.studentExams.previousPage}
                </Link>
              </Button>
            ) : (
              <span />
            )}
            <span>{zh.studentExams.page(historyPage)}</span>
            {historyPage < totalHistoryPages ? (
              <Button asChild variant="outline">
                <Link href={`/student/exams?historyPage=${historyPage + 1}`}>
                  {zh.studentExams.nextPage}
                </Link>
              </Button>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
