import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { requireUser } from "@/lib/auth/requireUser";

export default async function AdminPage() {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/calendar");
  return <>
    <AppHeader profile={profile} />
    <main className="page">
      <section className="panel">
        <h1>จัดการระบบ (Admin)</h1>
        <p>พื้นที่สำหรับจัดการพนักงาน ทีมงาน และข้อมูลระบบ จะพัฒนาเพิ่มเติมใน Phase 2</p>
        <p className="muted">Phase 1: ผู้ดูแลระบบสามารถจัดการแผนงานทั้งหมดได้จากปฏิทิน</p>
      </section>
    </main>
  </>;
}
