import { ExternalLink, FileDown } from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
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

export default async function StudentTextbooksPage() {
  const student = await requirePageUser([Role.STUDENT]);
  const assignments = await db.textbookAssignment.findMany({
    where: { studentId: student.id, textbook: { archivedAt: null } },
    orderBy: { textbook: { createdAt: "desc" } },
    include: {
      textbook: { include: { uploadedBy: { select: { name: true } } } },
    },
  });
  return (
    <main className="content-page">
      <header className="page-heading">
        <div>
          <p className="page-kicker">{zh.textbooks.kicker}</p>
          <h1>{zh.textbooks.studentTitle}</h1>
          <p>{zh.textbooks.studentDescription}</p>
        </div>
      </header>
      <div className="student-exam-grid">
        {assignments.map(({ textbook }) => (
          <Card key={textbook.id}>
            <CardHeader>
              <CardTitle>{textbook.title}</CardTitle>
              <CardDescription>
                {zh.textbooks.uploadedBy(textbook.uploadedBy.name)} ·{" "}
                {zh.textbooks.uploadedAt(
                  textbook.createdAt.toLocaleString("zh-CN"),
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="textbook-card-content">
              {textbook.description ? <p>{textbook.description}</p> : null}
              <div className="row-actions">
                <Button asChild>
                  <a
                    href={`/api/textbooks/${textbook.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink />
                    {zh.textbooks.open}
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={`/api/textbooks/${textbook.id}/download?download=1`}>
                    <FileDown />
                    {zh.textbooks.download}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {assignments.length === 0 ? (
          <div className="empty-state">{zh.textbooks.emptyStudent}</div>
        ) : null}
      </div>
    </main>
  );
}
