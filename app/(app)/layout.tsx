import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getActiveUser } from "@/lib/auth/dal";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const user = await getActiveUser();
  if (!user) redirect("/");
  return <AppShell user={user}>{children}</AppShell>;
}
