import { Role, UserStatus } from "@/app/generated/prisma/enums";
import { createTeacherAction, resetAccountPasswordAction, setAccountStatusAction } from "@/app/actions/accounts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePageUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { zh } from "@/lib/i18n/zh";

export default async function TeachersPage() {
  await requirePageUser([Role.OWNER]);
  const teachers = await db.user.findMany({
    where: { role: Role.TEACHER, archivedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, status: true, lastLoginAt: true, createdAt: true },
  });
  return (
    <main className="content-page">
      <header className="page-heading"><div><p className="page-kicker">{zh.accounts.teacherKicker}</p><h1>{zh.accounts.teacherTitle}</h1><p>{zh.accounts.teacherDescription}</p></div></header>
      <div className="split-grid">
        <Card>
          <CardHeader><CardTitle>{zh.accounts.addTeacher}</CardTitle><CardDescription>{zh.accounts.firstLogin}</CardDescription></CardHeader>
          <CardContent>
            <form action={createTeacherAction} className="stack-form">
              <div><Label htmlFor="teacher-name">{zh.accounts.name}</Label><Input id="teacher-name" name="name" required /></div>
              <div><Label htmlFor="teacher-email">{zh.accounts.email}</Label><Input id="teacher-email" name="email" type="email" required /></div>
              <div><Label htmlFor="teacher-password">{zh.accounts.temporaryPassword}</Label><Input id="teacher-password" name="temporaryPassword" type="password" minLength={12} required /></div>
              <Button type="submit">{zh.accounts.createTeacher}</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="wide-card">
          <CardHeader><CardTitle>{zh.accounts.existingTeachers}</CardTitle><CardDescription>{zh.common.accountCount(teachers.length)}</CardDescription></CardHeader>
          <CardContent>
            <Table><TableHeader><TableRow><TableHead>{zh.accounts.teacher}</TableHead><TableHead>{zh.accounts.status}</TableHead><TableHead>{zh.accounts.lastLogin}</TableHead><TableHead>{zh.accounts.actions}</TableHead></TableRow></TableHeader>
              <TableBody>{teachers.map((teacher) => <TableRow key={teacher.id}>
                <TableCell><strong>{teacher.name}</strong><div className="cell-muted">{teacher.email}</div></TableCell>
                <TableCell><Badge variant={teacher.status === UserStatus.ACTIVE ? "secondary" : "outline"}>{teacher.status === UserStatus.ACTIVE ? zh.common.enabled : zh.common.disabled}</Badge></TableCell>
                <TableCell>{teacher.lastLoginAt?.toLocaleDateString("zh-CN") ?? zh.accounts.neverLoggedIn}</TableCell>
                <TableCell><div className="row-actions">
                  <form action={setAccountStatusAction}><input type="hidden" name="userId" value={teacher.id} /><input type="hidden" name="status" value={teacher.status === UserStatus.ACTIVE ? "DISABLED" : "ACTIVE"} /><Button size="sm" variant="outline" type="submit">{teacher.status === UserStatus.ACTIVE ? zh.common.disabled : zh.common.enabled}</Button></form>
                  <form action={resetAccountPasswordAction} className="inline-reset"><input type="hidden" name="userId" value={teacher.id} /><Input aria-label={zh.accounts.temporaryPasswordFor(teacher.name)} name="temporaryPassword" type="password" placeholder={zh.accounts.newTemporaryPassword} minLength={12} required /><Button size="sm" variant="secondary" type="submit">{zh.accounts.reset}</Button></form>
                </div></TableCell>
              </TableRow>)}</TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
