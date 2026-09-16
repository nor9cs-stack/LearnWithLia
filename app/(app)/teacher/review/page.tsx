import { AttemptStatus, GradingMode, Role } from "@/app/generated/prisma/enums";
import { gradeResponseAction } from "@/app/actions/grading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { markdownToPlainText } from "@/lib/markdown";
import { zh } from "@/lib/i18n/zh";

export default async function ReviewPage({ searchParams }: { searchParams: Promise<{ student?: string; exam?: string }> }) {
  const teacher = await requirePageUser([Role.TEACHER]);
  const filters = await searchParams;
  const attempts = await db.attempt.findMany({
    where: {
      examVersion: { exam: { ownerId: teacher.id, ...(filters.exam ? { id: filters.exam } : {}) } },
      student: { studentTeachers: { some: { teacherId: teacher.id } }, ...(filters.student ? { id: filters.student } : {}) },
      status: { in: [AttemptStatus.SUBMITTED, AttemptStatus.PENDING_REVIEW, AttemptStatus.GRADED] },
    },
    orderBy: { submittedAt: "desc" },
    include: {
      student: { include: { studentProfile: true } },
      examVersion: { include: { exam: true } },
      responses: { where: { question: { gradingMode: GradingMode.MANUAL } }, include: { question: { include: { key: true } }, manualGrade: true } },
      unknownWords: { include: { question: true } },
    },
  });
  const [students, exams] = await Promise.all([
    db.user.findMany({ where: { role: Role.STUDENT, studentTeachers: { some: { teacherId: teacher.id } } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.exam.findMany({ where: { ownerId: teacher.id }, orderBy: { title: "asc" }, select: { id: true, title: true } }),
  ]);
  return (
    <main className="content-page"><header className="page-heading"><div><p className="page-kicker">{zh.review.kicker}</p><h1>{zh.review.title}</h1><p>{zh.review.description}</p></div></header>
      <form className="filter-bar"><label>{zh.review.student}<select name="student" defaultValue={filters.student ?? ""}><option value="">{zh.review.allStudents}</option>{students.map((student) => <option value={student.id} key={student.id}>{student.name}</option>)}</select></label><label>{zh.review.exam}<select name="exam" defaultValue={filters.exam ?? ""}><option value="">{zh.review.allExams}</option>{exams.map((exam) => <option value={exam.id} key={exam.id}>{exam.title}</option>)}</select></label><Button type="submit" variant="outline">{zh.review.filter}</Button></form>
      <div className="review-list">{attempts.map((attempt) => <Card key={attempt.id}><CardHeader><div className="card-title-row"><Badge variant={attempt.status === AttemptStatus.GRADED ? "secondary" : "default"}>{attempt.status === AttemptStatus.GRADED ? zh.review.complete : zh.review.pending}</Badge><span>{zh.common.attempt(attempt.attemptNumber)} · {attempt.submittedAt?.toLocaleString("zh-CN")}</span></div><CardTitle>{attempt.student.name} · {attempt.examVersion.exam.title}</CardTitle><CardDescription>{zh.review.summary(attempt.autoCorrectCount ?? 0, attempt.autoQuestionCount ?? 0, attempt.finalScore?.toString() ?? zh.common.pending)}</CardDescription></CardHeader><CardContent>
        {attempt.responses.map((response) => <form action={gradeResponseAction} className="grade-form" key={response.id}><input type="hidden" name="responseId" value={response.id}/><div className="grade-prompt"><strong>{markdownToPlainText(response.question.promptMd)}</strong><span>{zh.review.studentAnswer(response.textAnswer || zh.common.notAnswered)}</span><span>{zh.review.reference(response.question.key?.referenceAnswerMd || response.question.key?.rubricMd || response.question.key?.gradingNotesMd || zh.common.none)}</span></div><div><Label htmlFor={`score-${response.id}`}>{zh.review.scoreOutOf(response.question.points.toString())}</Label><Input id={`score-${response.id}`} name="score" type="number" min="0" max={response.question.points.toString()} step="0.01" defaultValue={response.manualGrade?.score.toString() ?? ""} required/></div><div><Label htmlFor={`feedback-${response.id}`}>{zh.review.responseFeedback}</Label><Textarea id={`feedback-${response.id}`} name="feedbackMd" defaultValue={response.manualGrade?.feedbackMd ?? ""}/></div><div><Label htmlFor={`attempt-feedback-${response.id}`}>{zh.review.attemptFeedback}</Label><Textarea id={`attempt-feedback-${response.id}`} name="attemptFeedbackMd" defaultValue={attempt.teacherFeedbackMd ?? ""}/></div><Button type="submit">{zh.review.saveGrade}</Button></form>)}
        {attempt.unknownWords.length ? <div className="word-review"><h3>{zh.review.unknownWords}</h3>{attempt.unknownWords.map((word) => <span key={word.id}><mark>{word.exactText}</mark> · {zh.common.question(word.question.order + 1)}</span>)}</div> : null}
      </CardContent></Card>)}{attempts.length === 0 ? <div className="empty-state">{zh.review.empty}</div> : null}</div>
    </main>
  );
}
