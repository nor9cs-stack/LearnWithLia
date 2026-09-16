import Link from "next/link";
import { Clock3, History, Play } from "lucide-react";
import { AttemptStatus, Role } from "@/app/generated/prisma/enums";
import { startAttemptAction } from "@/app/actions/attempts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { zh } from "@/lib/i18n/zh";

export default async function StudentExamsPage() {
  const student = await requirePageUser([Role.STUDENT]);
  if (!student.studentProfile) throw new Error(zh.errors.resourceNotFound);
  const assignments = await db.assignment.findMany({
    where: { studentProfileId: student.studentProfile.id },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: { examVersion: { include: { exam: true, _count: { select: { questions: true } } } }, attempts: { orderBy: { attemptNumber: "desc" } } },
  });
  return (
    <main className="content-page"><header className="page-heading"><div><p className="page-kicker">{zh.studentExams.kicker}</p><h1>{zh.studentExams.title}</h1><p>{zh.studentExams.description}</p></div></header>
      <div className="student-exam-grid">{assignments.map((assignment) => { const inProgress = assignment.attempts.find((attempt) => attempt.status === AttemptStatus.IN_PROGRESS); const completed = assignment.attempts.filter((attempt) => attempt.status !== AttemptStatus.IN_PROGRESS); const last = completed[0]; return <Card key={assignment.id}><CardHeader><div className="card-title-row"><Badge variant={inProgress ? "default" : "secondary"}>{inProgress ? zh.statuses.IN_PROGRESS : zh.studentExams.available}</Badge><span>{zh.exams.questionCount(assignment.examVersion._count.questions)}</span></div><CardTitle>{assignment.examVersion.title}</CardTitle><CardDescription>{assignment.dueAt ? zh.studentExams.due(assignment.dueAt.toLocaleString("zh-CN")) : zh.common.noDueDate}</CardDescription></CardHeader><CardContent><div className="assignment-meta"><span><Clock3/> {assignment.timeLimitMinutes ? zh.studentExams.minutes(assignment.timeLimitMinutes) : zh.common.untimed}</span><span><History/> {zh.studentExams.completed(completed.length, assignment.maxAttempts)}</span></div>{last ? <Link className="last-result" href={`/student/attempts/${last.id}`}><span>{zh.studentExams.last(last.autoQuestionCount ? zh.studentExams.autoAccuracy(Math.round(((last.autoCorrectCount ?? 0) / last.autoQuestionCount) * 100)) : zh.studentExams.waitingForGrade)}</span><strong>{last.finalScore != null ? zh.common.points(last.finalScore.toString()) : zh.studentExams.viewRecord}</strong></Link> : null}{inProgress ? <Button asChild className="w-full"><Link href={`/student/attempts/${inProgress.id}`}><Play/>{zh.studentExams.continue}</Link></Button> : <form action={startAttemptAction}><input type="hidden" name="assignmentId" value={assignment.id}/><Button className="w-full" type="submit"><Play/>{zh.studentExams.start}</Button></form>}</CardContent></Card>; })}{assignments.length === 0 ? <div className="empty-state">{zh.studentExams.empty}</div> : null}</div>
    </main>
  );
}
