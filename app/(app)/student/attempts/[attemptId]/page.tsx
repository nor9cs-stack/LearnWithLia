import { notFound } from "next/navigation";
import { AttemptStatus, Role } from "@/app/generated/prisma/enums";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExamRunner } from "@/components/exams/exam-runner";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { createStudentExamQuestions } from "@/lib/exams/student-dto";
import { markdownToPlainText } from "@/lib/markdown";
import { questionTypeLabel, zh } from "@/lib/i18n/zh";

export default async function AttemptPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const student = await requirePageUser([Role.STUDENT]);
  const { attemptId } = await params;
  const attempt = await db.attempt.findFirst({
    where: { id: attemptId, studentId: student.id },
    include: {
      responses: { include: { selected: true, manualGrade: true } },
      unknownWords: true,
      examVersion: {
        include: {
          exam: true,
          questions: {
            orderBy: { order: "asc" },
            include: { options: { orderBy: { order: "asc" } }, passage: true },
          },
        },
      },
    },
  });
  if (!attempt) notFound();
  if (attempt.status === AttemptStatus.IN_PROGRESS) {
    const questions = createStudentExamQuestions(
      attempt.examVersion.questions,
      attempt.responses,
      attempt.unknownWords,
    );
    return <main className="content-page exam-page"><header className="exam-topline"><div><Badge>{zh.statuses.IN_PROGRESS}</Badge><h1>{attempt.examVersion.title}</h1></div><span>{zh.results.serverRules}</span></header><ExamRunner attemptId={attempt.id} attemptNumber={attempt.attemptNumber} expiresAt={attempt.expiresAt?.toISOString() ?? null} questions={questions}/></main>;
  }

  const responseMap = new Map(attempt.responses.map((response) => [response.questionId, response]));
  const answerKeys = await db.questionKey.findMany({
    where: { question: { examVersionId: attempt.examVersionId } },
    include: { acceptableAnswers: true, correctOptions: true },
  });
  const keyMap = new Map(answerKeys.map((key) => [key.questionId, key]));
  const accuracy = attempt.autoQuestionCount ? Math.round(((attempt.autoCorrectCount ?? 0) / attempt.autoQuestionCount) * 100) : null;
  return (
    <main className="content-page"><header className="page-heading"><div><p className="page-kicker">{zh.common.attempt(attempt.attemptNumber)}</p><h1>{attempt.examVersion.title}</h1><p>{attempt.submittedAt?.toLocaleString("zh-CN")}</p></div><Badge variant={attempt.status === AttemptStatus.GRADED ? "secondary" : "outline"}>{attempt.status === AttemptStatus.GRADED ? zh.results.gradeComplete : zh.results.waitingForTeacher}</Badge></header>
      <div className="result-summary"><Card><CardHeader><CardDescription>{zh.results.autoAccuracy}</CardDescription><CardTitle>{accuracy == null ? "—" : `${accuracy}%`}</CardTitle></CardHeader><CardContent>{zh.results.correctAuto(attempt.autoCorrectCount ?? 0, attempt.autoQuestionCount ?? 0)}</CardContent></Card><Card><CardHeader><CardDescription>{zh.results.finalScore}</CardDescription><CardTitle>{attempt.finalScore == null ? zh.results.waitingForReview : `${attempt.finalScore.toString()} / ${attempt.examVersion.totalPoints.toString()}`}</CardTitle></CardHeader><CardContent>{attempt.pendingManualCount ? zh.results.pendingQuestions(attempt.pendingManualCount) : zh.results.gradedAt(attempt.gradedAt?.toLocaleString("zh-CN") ?? "—")}</CardContent></Card></div>
      <section className="result-list"><h2>{zh.results.details}</h2>{attempt.examVersion.questions.map((question, index) => { const response = responseMap.get(question.id); const key = keyMap.get(question.id); const isWrong = response?.autoCorrect === false; const submittedAnswer = response?.textAnswer ?? response?.numericAnswer?.toString() ?? response?.selected.map((selected) => question.options.find((option) => option.id === selected.optionId)?.contentMd).filter(Boolean).join("、") ?? (response?.booleanAnswer == null ? zh.common.notAnswered : response.booleanAnswer ? zh.common.correct : zh.common.incorrect); return <Card key={question.id} className={isWrong ? "wrong-answer" : undefined}><CardHeader><CardTitle>{zh.common.question(index + 1)} · {questionTypeLabel(question.type)}</CardTitle><CardDescription>{response?.autoCorrect == null ? zh.results.manualQuestion : response.autoCorrect ? zh.results.answerCorrect : zh.results.answerIncorrect}</CardDescription></CardHeader><CardContent><p>{markdownToPlainText(question.promptMd)}</p><div className="answer-review"><span>{zh.results.yourAnswer(submittedAnswer)}</span>{isWrong ? <span>{zh.results.reference(key?.acceptableAnswers.map((answer) => answer.value).join(" / ") || key?.numericAnswer?.toString() || key?.correctOptions.map((correct) => question.options.find((option) => option.id === correct.optionId)?.contentMd).filter(Boolean).join("、") || key?.referenceAnswerMd || (key?.trueFalseAnswer == null ? zh.results.seeFeedback : key.trueFalseAnswer ? zh.common.correct : zh.common.incorrect))}</span> : null}{response?.manualGrade ? <span>{zh.results.teacherFeedback(response.manualGrade.feedbackMd ?? zh.common.none)}</span> : null}</div></CardContent></Card>; })}</section>
    </main>
  );
}
