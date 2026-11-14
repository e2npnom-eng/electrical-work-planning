import { AppHeader } from "@/components/layout/AppHeader";
import { CalendarPage } from "@/components/calendar/CalendarPage";
import { requireUser } from "@/lib/auth/requireUser";

export default async function CalendarRoute({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const profile = await requireUser();
  const { plan } = await searchParams;
  return <>
    <AppHeader profile={profile} />
    <main className="page">
      <CalendarPage profile={profile} initialPlanId={plan} />
    </main>
  </>;
}
