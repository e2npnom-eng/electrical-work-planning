import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { EmployeeTable } from "@/components/admin/EmployeeTable";
import type { Row } from "@/components/admin/EmployeeTable";
import { requireUser } from "@/lib/auth/requireUser";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/calendar");

  const supabase = await createClient();
  const { data } = await supabase.from("employees")
    .select("id, employee_code, full_name, role, active").order("employee_code");
  const rows = (data ?? []) as Row[];

  return <>
    <AppHeader profile={profile} />
    <main className="page">
      <div className="page-head">
        <div>
          <h1>จัดการระบบ</h1>
          <p className="muted" style={{ margin: 0 }}>กำหนดสิทธิ์ (ผู้ดูแลระบบ / ผู้บริหาร / พนักงาน) และเปิด-ปิดบัญชี · พนักงานทั้งหมด {rows.length} คน</p>
        </div>
      </div>
      <EmployeeTable initial={rows} meId={profile.id} />
    </main>
  </>;
}
