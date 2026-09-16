import Link from "next/link";
import { Plus } from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
import { createExamAction } from "@/app/actions/exams";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { statusLabel, zh } from "@/lib/i18n/zh";

export default async function ExamsPage() {
  const teacher = await requirePageUser([Role.TEACHER]);
  const exams = await db.exam.findMany({ where: { ownerId: teacher.id, archivedAt: null }, orderBy: { updatedAt: "desc" }, include: { versions: { orderBy: { versionNumber: "desc" }, take: 1, include: { _count: { select: { questions: true, assignments: true } } } } } });
  return (
    <main className="content-page">
      <header className="page-heading"><div><p className="page-kicker">{zh.exams.kicker}</p><h1>{zh.exams.title}</h1><p>{zh.exams.description}</p></div></header>
      <div className="split-grid">
        <Card><CardHeader><CardTitle>{zh.exams.create}</CardTitle><CardDescription>{zh.exams.createDescription}</CardDescription></CardHeader><CardContent><form action={createExamAction} className="stack-form"><div><Label htmlFor="exam-title">{zh.exams.name}</Label><Input id="exam-title" name="title" required /></div><div><Label htmlFor="exam-description">{zh.exams.notes}</Label><Input id="exam-description" name="description" /></div><Button type="submit"><Plus/>{zh.exams.createDraft}</Button></form></CardContent></Card>
        <div className="exam-grid">{exams.map((exam) => { const current = exam.versions[0]; return <Link className="exam-card" href={`/teacher/exams/${exam.id}`} key={exam.id}><div><Badge variant="secondary">{statusLabel(exam.status)}</Badge><span>v{current?.versionNumber ?? 1}</span></div><h2>{exam.title}</h2><p>{exam.description ?? zh.exams.noDescription}</p><footer><span>{zh.exams.questionCount(current?._count.questions ?? 0)}</span><span>{zh.exams.assignmentCount(current?._count.assignments ?? 0)}</span></footer></Link>; })}{exams.length === 0 ? <div className="empty-state">{zh.exams.empty}</div> : null}</div>
      </div>
    </main>
  );
}
