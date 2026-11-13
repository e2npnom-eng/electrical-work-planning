"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlanDetail } from "@/components/plans/PlanDetail";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan } from "@/types/plan";

const STATUS_LABELS: Record<string, string> = {
  planned: "วางแผนแล้ว", in_progress: "กำลังดำเนินการ", completed: "เสร็จสิ้น", cancelled: "ยกเลิก"
};

const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (v: string) =>
  new Date(v).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

export function MySchedule({ profile }: { profile: EmployeeProfile }) {
  const supabase = useMemo(() => createClient(), []);
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const empId = profile.id;
  const [month, setMonth] = useState("");
  const [allMonths, setAllMonths] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<WorkPlan | null>(null);

  useEffect(() => {
    const d = new Date();
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [planResult] = await Promise.all([
        supabase.from("work_plans").select("*, controller:employees!work_plans_controller_id_fkey(id, full_name, employee_code), creator:employees!work_plans_created_by_fkey(id, full_name, employee_code), work_plan_members(employee_id, employee:employees(id, full_name, employee_code))").order("start_at")
      ]);
      if (cancelled) return;
      if (planResult.error) setError(planResult.error.message);
      else setPlans((planResult.data ?? []) as unknown as WorkPlan[]);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  const emp = profile;
  const useMonth = !allMonths && month !== "";

  const rows = useMemo(() => {
    let from = 0, to = 0;
    if (useMonth) {
      const [y, m] = month.split("-").map(Number);
      from = new Date(y, m - 1, 1).getTime();
      to = new Date(y, m, 1).getTime();
    }
    return plans
      .filter(p => {
        const isController = p.controller_id === empId;
        const isMember = (p.work_plan_members ?? []).some(m => m.employee_id === empId);
        if (!isController && !isMember) return false;
        if (useMonth) {
          return new Date(p.start_at).getTime() < to && new Date(p.end_at).getTime() >= from;
        }
        return true;
      })
      .map(p => ({ plan: p, role: p.controller_id === empId ? "ผู้ควบคุมงาน" : "ผู้ปฏิบัติงาน" }));
  }, [plans, empId, month, useMonth]);

  const periodLabel = useMonth
    ? (() => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" }); })()
    : "ทุกช่วงเวลา";

  function printSheet() {
    window.print();
  }

  function exportPdf() {
    const original = document.title;
    document.title = `ตารางงาน_${emp.employee_code}_${useMonth ? month : "ทั้งหมด"}`;
    window.addEventListener("afterprint", () => { document.title = original; }, { once: true });
    window.print();
  }

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1>ตารางงานของฉัน</h1>
          <p className="muted" style={{ margin: 0 }}>แผนงานที่พนักงานเป็นผู้ควบคุมงานหรือผู้ปฏิบัติงาน</p>
        </div>
      </div>

      <div className="sched-controls no-print">
        <div className="field">
          <label htmlFor="sc-emp">พนักงาน</label>
          <input id="sc-emp" readOnly value={`${profile.full_name} (${profile.employee_code})`} />
        </div>
        <div className="field">
          <label htmlFor="sc-month">เดือน</label>
          <input id="sc-month" type="month" value={month} disabled={allMonths}
            onChange={e => setMonth(e.target.value)} />
        </div>
        <label className="check-inline">
          <input type="checkbox" checked={allMonths} onChange={e => setAllMonths(e.target.checked)} />
          แสดงทุกเดือน
        </label>
        <div className="sched-actions">
          <button className="btn secondary" onClick={printSheet}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z" /></svg>
            พิมพ์
          </button>
          <button className="btn" onClick={exportPdf}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" /></svg>
            ส่งออก PDF
          </button>
        </div>
      </div>
      <p className="muted no-print" style={{ margin: "-4px 0 20px" }}>
        ส่งออก PDF: ในหน้าต่างพิมพ์ที่เปิดขึ้น ให้เลือกเครื่องพิมพ์เป็น “บันทึกเป็น PDF” (Save as PDF)
      </p>

      {error && <p className="error no-print" role="alert">{error}</p>}

      {loading ? <p>กำลังโหลดตารางงาน...</p> : (
        <section className="sheet">
          <div className="sheet-title">
            <img src="/pea-logo.png" alt="โลโก้ การไฟฟ้าส่วนภูมิภาค" className="sheet-logo" />
            <h2>ตารางแผนงานปฏิบัติงาน</h2>
            <div>ผปบ.กฟจ.นครพนม</div>
          </div>
          <div className="sheet-meta">
            <div><b>ผู้ปฏิบัติงาน:</b> {emp.full_name} ({emp.employee_code})</div>
            <div><b>ช่วงเวลา:</b> {periodLabel}</div>
            <div><b>จำนวนแผนงาน:</b> {rows.length} รายการ</div>
            <div><b>พิมพ์เมื่อ:</b> {fmtDate(new Date().toISOString())} {fmtTime(new Date().toISOString())} น.</div>
          </div>

          <div className="sheet-table-wrap">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>ที่</th>
                  <th>วันที่เริ่ม</th>
                  <th>วันที่สิ้นสุด</th>
                  <th>ชื่อแผนงาน</th>
                  <th>สถานที่</th>
                  <th>บทบาท</th>
                  <th>ผู้ควบคุมงาน</th>
                  <th>ทีมงาน</th>
                  <th>สถานะ</th>
                  <th className="no-print">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: 28 }} className="muted">ไม่มีแผนงานในช่วงเวลานี้</td></tr>
                )}
                {rows.map(({ plan, role }, i) => {
                  const team = (plan.work_plan_members ?? []).map(m => m.employee?.full_name).filter(Boolean).join(", ");
                  return (
                    <tr key={plan.id}>
                      <td className="c">{i + 1}</td>
                      <td>{fmtDate(plan.start_at)}<br /><small>{fmtTime(plan.start_at)} น.</small></td>
                      <td>{fmtDate(plan.end_at)}<br /><small>{fmtTime(plan.end_at)} น.</small></td>
                      <td style={{ fontWeight: 600 }}>{plan.title}</td>
                      <td>{plan.location}</td>
                      <td>{role}</td>
                      <td>{plan.controller?.full_name ?? "-"}</td>
                      <td>{team || "-"}</td>
                      <td><span className={`badge s-${plan.status}`} style={{ margin: 0 }}>{STATUS_LABELS[plan.status] ?? plan.status}</span></td>
                      <td className="no-print">
                        <button className="detail-btn" onClick={() => setSelected(plan)}>ดูรายละเอียด</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sign-row">
            <div><div className="sign-line" />ผู้จัดทำ<br /><small>(.......................................)</small></div>
            <div><div className="sign-line" />ผู้ตรวจสอบ<br /><small>(.......................................)</small></div>
            <div><div className="sign-line" />ผู้อนุมัติ<br /><small>(.......................................)</small></div>
          </div>
          <div className="print-footer">การไฟฟ้าส่วนภูมิภาคจังหวัดนครพนม</div>
        </section>
      )}

      {selected && <PlanDetail plan={selected} profile={profile}
        canEdit={false} canDelete={false}
        onClose={() => setSelected(null)} onEdit={() => undefined} onDelete={() => undefined} />}
    </div>
  );
}
