import { redirect } from "next/navigation";
import { Role } from "@/app/generated/prisma/enums";
import { requirePageUser } from "@/lib/auth/dal";

export default async function DashboardPage() {
  const user = await requirePageUser();
  if (user.role === Role.OWNER) redirect("/owner/teachers");
  if (user.role === Role.TEACHER) redirect("/teacher/exams");
  redirect("/student/exams");
}
