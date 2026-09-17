import { ExternalLink, FileDown, Trash2 } from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
import { deleteTextbookAction } from "@/app/actions/textbooks";
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

export default async function OwnerTextbooksPage() {
  await requirePageUser([Role.OWNER]);
  const textbooks = await db.textbook.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
      _count: { select: { assignments: true } },
    },
  });
  return (
    <main className="content-page">
      <header className="page-heading">
        <div>
          <p className="page-kicker">{zh.textbooks.kicker}</p>
          <h1>{zh.textbooks.ownerTitle}</h1>
          <p>{zh.textbooks.ownerDescription}</p>
        </div>
      </header>
      <div className="student-exam-grid">
        {textbooks.map((textbook) => (
          <Card key={textbook.id}>
            <CardHeader>
              <CardTitle>{textbook.title}</CardTitle>
              <CardDescription>
                {zh.textbooks.uploadedBy(textbook.uploadedBy.name)} ·{" "}
                {zh.textbooks.uploadedAt(
                  textbook.createdAt.toLocaleString("zh-CN"),
                )}{" "}
                · {zh.common.studentCount(textbook._count.assignments)}
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
                  <a href={`/api/textbooks/${textbook.id}/download?download=1`}>
                    <FileDown />
                    {zh.textbooks.download}
                  </a>
                </Button>
                <form action={deleteTextbookAction}>
                  <input type="hidden" name="textbookId" value={textbook.id} />
                  <Button type="submit" variant="destructive" size="sm">
                    <Trash2 />
                    {zh.textbooks.delete}
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
        {textbooks.length === 0 ? (
          <div className="empty-state">{zh.textbooks.emptyOwner}</div>
        ) : null}
      </div>
    </main>
  );
}
