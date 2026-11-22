import { AppHeader } from "@/components/layout/AppHeader";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { requireUser } from "@/lib/auth/requireUser";

export default async function DashboardPage() {
  const profile = await requireUser();
  return <>
    <AppHeader profile={profile} />
    <main className="page db-wide">
      <Dashboard profile={profile} />
    </main>
  </>;
}
