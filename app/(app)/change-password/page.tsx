import { changePasswordAction } from "@/app/actions/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireUser } from "@/lib/auth/dal";
import { zh } from "@/lib/i18n/zh";

export default async function ChangePasswordPage() {
  await requireUser({ allowPasswordChange: true });
  return (
    <main className="content-page narrow-page">
      <Card>
        <CardHeader>
          <CardTitle>{zh.password.title}</CardTitle>
          <CardDescription>{zh.password.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={changePasswordAction} className="stack-form">
            <div><Label htmlFor="currentPassword">{zh.password.current}</Label><Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required /></div>
            <div><Label htmlFor="newPassword">{zh.password.next}</Label><Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required /><p className="field-help">{zh.password.requirements}</p></div>
            <div><Label htmlFor="confirmPassword">{zh.password.confirm}</Label><Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required /></div>
            <Button type="submit">{zh.password.save}</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
