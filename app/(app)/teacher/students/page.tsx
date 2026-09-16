import { Role, UserStatus } from "@/app/generated/prisma/enums";
import { createStudentAction, resetAccountPasswordAction, setAccountStatusAction } from "@/app/actions/accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { zh } from "@/lib/i18n/zh";

export default async function StudentsPage() {
  const teacher = await requirePageUser([Role.TEACHER]);
  const links = await db.teacherStudent.findMany({
    where: { teacherId: teacher.id },
    orderBy: { createdAt: "desc" },
    select: { student: { select: { id: true, name: true, status: true, studentProfile: { select: { studentNumber: true } } } } },
  });
  return (
    <main className="content-page">
      <header className="page-heading"><div><p className="page-kicker">{zh.accounts.studentKicker}</p><h1>{zh.accounts.studentTitle}</h1><p>{zh.accounts.studentDescription}</p></div></header>
      <div className="split-grid">
        <Card><CardHeader><CardTitle>{zh.accounts.addStudent}</CardTitle><CardDescription>{zh.accounts.studentPrivacy}</CardDescription></CardHeader><CardContent>
          <form action={createStudentAction} className="stack-form">
            <div><Label htmlFor="student-name">{zh.accounts.studentName}</Label><Input id="student-name" name="name" required /></div>
            <div><Label htmlFor="student-number">{zh.accounts.studentNumber}</Label><Input id="student-number" name="studentNumber" autoCapitalize="none" required /></div>
            <div><Label htmlFor="student-password">{zh.accounts.temporaryPassword}</Label><Input id="student-password" name="temporaryPassword" type="password" minLength={12} required /></div>
            <Button type="submit">{zh.accounts.createStudent}</Button>
          </form>
        </CardContent></Card>
        <Card className="wide-card"><CardHeader><CardTitle>{zh.accounts.studentList}</CardTitle><CardDescription>{zh.common.studentCount(links.length)}</CardDescription></CardHeader><CardContent>
          <Table><TableHeader><TableRow><TableHead>{zh.accounts.student}</TableHead><TableHead>{zh.accounts.status}</TableHead><TableHead>{zh.accounts.accountActions}</TableHead></TableRow></TableHeader><TableBody>
            {links.map(({ student }) => <TableRow key={student.id}><TableCell><strong>{student.name}</strong><div className="cell-muted">{student.studentProfile?.studentNumber}</div></TableCell><TableCell><Badge variant={student.status === UserStatus.ACTIVE ? "secondary" : "outline"}>{student.status === UserStatus.ACTIVE ? zh.common.enabled : zh.common.disabled}</Badge></TableCell><TableCell><div className="row-actions"><form action={setAccountStatusAction}><input type="hidden" name="userId" value={student.id}/><input type="hidden" name="status" value={student.status === UserStatus.ACTIVE ? "DISABLED" : "ACTIVE"}/><Button size="sm" variant="outline" type="submit">{student.status === UserStatus.ACTIVE ? zh.common.disabled : zh.common.enabled}</Button></form><form action={resetAccountPasswordAction} className="inline-reset"><input type="hidden" name="userId" value={student.id}/><Input name="temporaryPassword" type="password" minLength={12} placeholder={zh.accounts.newTemporaryPassword} aria-label={zh.accounts.temporaryPasswordFor(student.name)} required/><Button size="sm" variant="secondary" type="submit">{zh.accounts.reset}</Button></form></div></TableCell></TableRow>)}
          </TableBody></Table>
        </CardContent></Card>
      </div>
    </main>
  );
}
