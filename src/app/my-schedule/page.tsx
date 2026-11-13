import { AppHeader } from "@/components/layout/AppHeader";
import { MySchedule } from "@/components/schedule/MySchedule";
import { requireUser } from "@/lib/auth/requireUser";

export default async function MySchedulePage() {
  const profile = await requireUser();
  return <>
    <AppHeader profile={profile} />
    <main className="page">
      <MySchedule profile={profile} />
    </main>
  </>;
}
