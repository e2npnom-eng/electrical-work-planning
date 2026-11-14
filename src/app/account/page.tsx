import { AppHeader } from "@/components/layout/AppHeader";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { requireUser } from "@/lib/auth/requireUser";

export default async function AccountPage() {
  const profile = await requireUser();
  return <>
    <AppHeader profile={profile} />
    <main className="page">
      <ChangePasswordForm profile={profile} />
    </main>
  </>;
}
