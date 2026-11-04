import { CalendarPage } from "@/components/calendar/CalendarPage";
import { AppHeader } from "@/components/layout/AppHeader";
import { requireUser } from "@/lib/auth/requireUser";

export default async function CalendarRoute() {
  const profile = await requireUser();
  return <>
    <AppHeader profile={profile} />
    <main className="page">
      <CalendarPage profile={profile} />
    </main>
  </>;
}
