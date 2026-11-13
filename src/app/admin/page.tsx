import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/AppHeader";
import { requireUser } from "@/lib/auth/requireUser";
import { createClient } from "@/lib/supabase/server";

type Row = { id: string; employee_code: string; full_name: string; role: string; active: boolean };

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
          <p className="muted" style={{ margin: 0 }}>รายชื่อพนักงานที่เข้าใช้งานระบบ ({rows.length} คน) การเพิ่มและปิดบัญชีจะพัฒนาในเฟสถัดไป</p>
        </div>
      </div>
      <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <div className="table-scroll">
          <div className="table-row table-head">
            <span>รหัสพนักงาน</span><span>ชื่อ-สกุล</span><span>สิทธิ์</span><span>สถานะ</span>
          </div>
          {rows.map(r => (
            <div className="table-row" key={r.id}>
              <span style={{ fontWeight: 600 }}>{r.employee_code}</span>
              <span>{r.full_name}</span>
              <span>
                <span className={`badge ${r.role === "admin" ? "" : "s-planned"}`}
                  style={{ margin: 0, ...(r.role === "admin" ? { background: "#2A1450", color: "#fff" } : {}) }}>
                  {r.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน"}
                </span>
              </span>
              <span>
                <i className="dot" style={{ background: r.active ? "#0F766E" : "#8A8299" }} />
                {r.active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  </>;
}
