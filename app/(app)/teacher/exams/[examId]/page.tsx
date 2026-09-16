import Link from "next/link";
import { AlertCircle, Archive, CopyPlus, Plus, Send, StopCircle } from "lucide-react";
import { ExamStatus, Role } from "@/app/generated/prisma/enums";
import { addQuestionAction, assignExamAction, cloneExamVersionAction, publishExamAction, setExamStatusAction } from "@/app/actions/exams";
import { FileUpload } from "@/components/exams/file-upload";
import { SortableQuestionList, type QuestionEditorItem } from "@/components/exams/sortable-question-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getOwnedVersion, versionPublicationResult } from "@/lib/exams/service";
import { questionTypeLabel, statusLabel, zh } from "@/lib/i18n/zh";

export default async function ExamEditorPage({ params, searchParams }: { params: Promise<{ examId: string }>; searchParams: Promise<{ version?: string }> }) {
  const teacher = await requirePageUser([Role.TEACHER]);
  const { examId } = await params;
  const query = await searchParams;
  const exam = await db.exam.findFirst({ where: { id: examId, ownerId: teacher.id }, include: { versions: { orderBy: { versionNumber: "desc" } } } });
  if (!exam) throw new Error(zh.errors.examNotFound);
  const selected = exam.versions.find((version) => version.id === query.version) ?? exam.versions[0];
  if (!selected) throw new Error(zh.errors.examVersionNotFound);
  const version = await getOwnedVersion(teacher.id, selected.id);
  const publication = versionPublicationResult(version);
  const editable = version.status === ExamStatus.DRAFT;
  const students = await db.studentProfile.findMany({ where: { user: { studentTeachers: { some: { teacherId: teacher.id } } } }, orderBy: { studentNumber: "asc" }, select: { id: true, studentNumber: true, user: { select: { name: true } } } });
  const editorItems: QuestionEditorItem[] = version.questions.map((question) => ({
    id: question.id, type: question.type, gradingMode: question.gradingMode, promptMd: question.promptMd, passageMd: question.passage?.contentMd ?? "", points: question.points.toString(), optionsText: question.options.map((option) => option.contentMd).join("\n"),
    correctOptionKeys: question.key?.correctOptions.map((correct) => question.options.find((option) => option.id === correct.optionId)?.optionKey).filter(Boolean).join(",") ?? "",
    trueFalseAnswer: question.key?.trueFalseAnswer == null ? "" : String(question.key.trueFalseAnswer), acceptableAnswers: question.key?.acceptableAnswers.map((answer) => answer.value).join("\n") ?? "",
    numericAnswer: question.key?.numericAnswer?.toString() ?? "", numericTolerance: question.key?.numericTolerance?.toString() ?? "", referenceAnswerMd: question.key?.referenceAnswerMd ?? "", rubricMd: question.key?.rubricMd ?? "", gradingNotesMd: question.key?.gradingNotesMd ?? "",
    caseSensitive: question.caseSensitive, trimWhitespace: question.trimWhitespace, normalizePunctuation: question.normalizePunctuation,
  }));
  const editorRevision = version.questions
    .map((question) => `${question.id}:${question.order}:${question.updatedAt.getTime()}`)
    .join("|");
  return (
    <main className="content-page">
      <header className="page-heading"><div><p className="page-kicker">{zh.examEditor.kicker}</p><h1>{exam.title}</h1><p>{zh.examEditor.version(version.versionNumber)} · <Badge variant="secondary">{statusLabel(version.status)}</Badge></p></div><div className="row-actions"><Button asChild variant="outline"><Link href="/teacher/exams">{zh.examEditor.back}</Link></Button>{editable ? <form action={publishExamAction}><input type="hidden" name="versionId" value={version.id}/><Button type="submit" disabled={!publication.valid}><Send/>{zh.examEditor.enable}</Button></form> : <form action={cloneExamVersionAction}><input type="hidden" name="versionId" value={version.id}/><Button type="submit"><CopyPlus/>{zh.examEditor.newVersion}</Button></form>}</div></header>
      <div className="version-tabs">{exam.versions.map((item) => <Link key={item.id} className={item.id === version.id ? "active" : ""} href={`/teacher/exams/${exam.id}?version=${item.id}`}>v{item.versionNumber} · {statusLabel(item.status)}</Link>)}</div>
      {!publication.valid ? <Alert><AlertCircle/><AlertTitle>{zh.examEditor.cannotEnable}</AlertTitle><AlertDescription><ul>{publication.issues.map((issue, index) => <li key={`${issue.questionId}-${issue.field}-${index}`}>{issue.message}</li>)}</ul></AlertDescription></Alert> : null}
      {editable ? <div className="editor-grid"><Card><CardHeader><CardTitle>{zh.examEditor.importTitle}</CardTitle><CardDescription>{zh.examEditor.importDescription}</CardDescription></CardHeader><CardContent><FileUpload versionId={version.id}/><div className="import-list">{version.uploadedFiles.map((file) => <div key={file.id}><div className="import-status-row"><strong>{file.originalName}</strong><Badge variant="outline">{statusLabel(file.importStatus)}</Badge></div>{file.importMessage ? <span>{file.importMessage}</span> : null}{file.extractedText ? <details><summary>{zh.examEditor.extractedText}</summary><pre className="extracted-source">{file.extractedText}</pre></details> : null}</div>)}</div></CardContent></Card><Card><CardHeader><CardTitle>{zh.examEditor.addTitle}</CardTitle><CardDescription>{zh.examEditor.addDescription}</CardDescription></CardHeader><CardContent><form action={addQuestionAction}><input type="hidden" name="versionId" value={version.id}/><Button type="submit"><Plus/>{zh.examEditor.addQuestion}</Button></form></CardContent></Card></div> : null}
      <section className="editor-section"><div className="section-title"><div><h2>{zh.examEditor.questions}</h2><p>{editable ? zh.examEditor.reorderHelp : zh.examEditor.lockedHelp}</p></div></div>{editable ? <SortableQuestionList key={editorRevision} versionId={version.id} initialQuestions={editorItems}/> : <div className="locked-list">{version.questions.map((question) => <Card key={question.id}><CardHeader><CardTitle>{zh.common.question(question.order + 1)} · {questionTypeLabel(question.type)}</CardTitle><CardDescription>{zh.common.points(question.points.toString())}</CardDescription></CardHeader><CardContent><p>{question.promptMd}</p></CardContent></Card>)}</div>}</section>
      {version.status === ExamStatus.ENABLED ? <section className="editor-section"><Card><CardHeader><CardTitle>{zh.examEditor.assignTitle}</CardTitle><CardDescription>{zh.examEditor.assignDescription}</CardDescription></CardHeader><CardContent><form action={assignExamAction} className="assignment-form"><input type="hidden" name="versionId" value={version.id}/><fieldset><legend>{zh.examEditor.chooseStudents}</legend>{students.map((student) => <label className="check-row" key={student.id}><input type="checkbox" name="studentIds" value={student.id}/>{student.user.name} · {student.studentNumber}</label>)}</fieldset><div><Label htmlFor="availableFrom">{zh.examEditor.availableFrom}</Label><Input id="availableFrom" name="availableFrom" type="datetime-local"/></div><div><Label htmlFor="dueAt">{zh.examEditor.dueAt}</Label><Input id="dueAt" name="dueAt" type="datetime-local"/></div><div><Label htmlFor="maxAttempts">{zh.examEditor.maxAttempts}</Label><Input id="maxAttempts" name="maxAttempts" type="number" min="1" placeholder={zh.common.unlimited}/></div><div><Label htmlFor="timeLimitMinutes">{zh.examEditor.timeLimit}</Label><Input id="timeLimitMinutes" name="timeLimitMinutes" type="number" min="1" max="480" placeholder={zh.common.unlimited}/></div><Button type="submit">{zh.examEditor.saveAssignment}</Button></form></CardContent></Card><div className="row-actions danger-zone"><form action={setExamStatusAction}><input type="hidden" name="versionId" value={version.id}/><input type="hidden" name="status" value="DISABLED"/><Button type="submit" variant="outline"><StopCircle/>{zh.examEditor.disable}</Button></form><form action={setExamStatusAction}><input type="hidden" name="versionId" value={version.id}/><input type="hidden" name="status" value="ARCHIVED"/><Button type="submit" variant="ghost"><Archive/>{zh.examEditor.archive}</Button></form></div></section> : null}
    </main>
  );
}
