import Link from "next/link";
import { BookOpenCheck, ClipboardList, GraduationCap, LogOut, Sparkles, Users } from "lucide-react";
import { Role } from "@/app/generated/prisma/enums";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleLabel, zh } from "@/lib/i18n/zh";
import { APP_CONFIG } from "@/lib/config";

type ShellUser = { name: string; role: Role };

const navigation = {
  OWNER: [{ href: "/owner/teachers", label: zh.shell.teachers, icon: Users }],
  TEACHER: [
    { href: "/teacher/students", label: zh.shell.students, icon: Users },
    { href: "/teacher/exams", label: zh.shell.exams, icon: ClipboardList },
    { href: "/teacher/review", label: zh.shell.review, icon: BookOpenCheck },
  ],
  STUDENT: [{ href: "/student/exams", label: zh.shell.myExams, icon: GraduationCap }],
} satisfies Record<Role, { href: string; label: string; icon: typeof Users }[]>;

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  return (
    <div className="app-frame">
      <aside className="app-sidebar">
        <Link href="/dashboard" className="app-logo">
          <span>L</span>
          <div><strong>{APP_CONFIG.name}</strong><small>{zh.shell.center}</small></div>
        </Link>
        <nav aria-label={zh.shell.navigation}>
          {navigation[user.role].map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href} className={cn("nav-link")}>
              <Icon aria-hidden="true" />{label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="user-chip"><Sparkles aria-hidden="true" /><span>{user.name}<small>{roleLabel(user.role)}</small></span></div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" size="sm"><LogOut />{zh.shell.logout}</Button>
          </form>
        </div>
      </aside>
      <div className="app-main">{children}</div>
    </div>
  );
}
