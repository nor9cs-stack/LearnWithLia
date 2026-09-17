import { ExternalLink, FileDown, Trash2 } from "lucide-react";
import { Role, UserStatus } from "@/app/generated/prisma/enums";
import {
  deleteTextbookAction,
  updateTextbookAssignmentsAction,
} from "@/app/actions/textbooks";
import { TextbookUploadForm } from "@/components/textbooks/textbook-upload-form";
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
import { zh } from "@/lib/i18n/zh";

function formatBytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default async function TeacherTextbooksPage() {
  const teacher = await requirePageUser([Role.TEACHER]);
  const [students, textbooks] = await Promise.all([
    db.teacherStudent.findMany({
      where: {
        teacherId: teacher.id,
        student: { role: Role.STUDENT, status: UserStatus.ACTIVE, archivedAt: null },
      },
      orderBy: { student: { name: "asc" } },
      select: {
        student: {
          select: {
            id: true,
            name: true,
            studentProfile: { select: { studentNumber: true } },
          },
        },
      },
    }),
    db.textbook.findMany({
      where: { uploadedById: teacher.id, archivedAt: null },
      orderBy: { createdAt: "desc" },
      include: { assignments: { select: { studentId: true } } },
    }),
  ]);
  const studentOptions = students.flatMap(({ student }) =>
    student.studentProfile
      ? [
          {
            id: student.id,
            name: student.name,
            studentNumber: student.studentProfile.studentNumber,
          },
        ]
      : [],
  );

  return (
    <main className="content-page">
      <header className="page-heading">
        <div>
          <p className="page-kicker">{zh.textbooks.kicker}</p>
          <h1>{zh.textbooks.teacherTitle}</h1>
          <p>{zh.textbooks.teacherDescription}</p>
        </div>
      </header>
      <div className="textbook-layout">
        <Card>
          <CardHeader>
            <CardTitle>{zh.textbooks.uploadTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            <TextbookUploadForm students={studentOptions} />
          </CardContent>
        </Card>
        <div className="textbook-list">
          {textbooks.map((textbook) => {
            const assigned = new Set(
              textbook.assignments.map((assignment) => assignment.studentId),
            );
            return (
              <Card key={textbook.id}>
                <CardHeader>
                  <CardTitle>{textbook.title}</CardTitle>
                  <CardDescription>
                    {zh.textbooks.uploadedAt(
                      textbook.createdAt.toLocaleString("zh-CN"),
                    )}{" "}
                    · {zh.textbooks.size(formatBytes(textbook.sizeBytes))}
                  </CardDescription>
                </CardHeader>
                <CardContent className="textbook-card-content">
                  {textbook.description ? <p>{textbook.description}</p> : null}
                  <div className="row-actions">
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/api/textbooks/${textbook.id}/download`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink />
                        {zh.textbooks.open}
                      </a>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <a
                        href={`/api/textbooks/${textbook.id}/download?download=1`}
                      >
                        <FileDown />
                        {zh.textbooks.download}
                      </a>
                    </Button>
                  </div>
                  <form
                    action={updateTextbookAssignmentsAction}
                    className="textbook-assignment-form"
                  >
                    <input
                      type="hidden"
                      name="textbookId"
                      value={textbook.id}
                    />
                    <fieldset>
                      <legend>{zh.textbooks.assignedStudents}</legend>
                      {studentOptions.map((student) => (
                        <label className="check-row" key={student.id}>
                          <input
                            type="checkbox"
                            name="studentIds"
                            value={student.id}
                            defaultChecked={assigned.has(student.id)}
                          />
                          <span>
                            {student.name} · {student.studentNumber}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <Button type="submit" variant="secondary" size="sm">
                      {zh.textbooks.saveAssignments}
                    </Button>
                  </form>
                  <form action={deleteTextbookAction}>
                    <input
                      type="hidden"
                      name="textbookId"
                      value={textbook.id}
                    />
                    <Button type="submit" variant="destructive" size="sm">
                      <Trash2 />
                      {zh.textbooks.delete}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
          {textbooks.length === 0 ? (
            <div className="empty-state">{zh.textbooks.emptyTeacher}</div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
