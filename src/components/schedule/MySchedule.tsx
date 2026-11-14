"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlanDetail } from "@/components/plans/PlanDetail";
import { PLAN_SELECT, approvalOf, canViewAll, fmtDate, fmtTime, statusLabel } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan } from "@/types/plan";

export function MySchedule({ profile }: { profile: EmployeeProfile }) {
  const supabase = useMemo(() => createClient(), []);
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const viewAll = canViewAll(profile.role);
  const [people, setPeople] = useState<EmployeeProfile[]>([]);
  const [empId, setEmpId] = useState(profile.id);
  const [approvedOnly, setApprovedOnly] = useState(false);
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
    if (!viewAll) return;
    void supabase.from("employees").select("id, employee_code, full_name, role, active")
      .eq("active", true).order("full_name")
      .then(({ data }) => { if (data) setPeople(data as EmployeeProfile[]); });
  }, [supabase, viewAll]);

  useEffect(() => {
    if (!allMonths && month === "") return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      let query = supabase.from("work_plans").select(PLAN_SELECT).order("start_at");
      if (!allMonths) {
        const [y, m] = month.split("-").map(Number);
        query = query.lt("start_at", new Date(y, m, 1).toISOString()).gte("end_at", new Date(y, m - 1, 1).toISOString());
      }
      const res = await query;
      if (cancelled) return;
      if (res.error) setError(res.error.message);
      else { setError(""); setPlans((res.data ?? []) as unknown as WorkPlan[]); }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [supabase, month, allMonths]);

  const everyone = empId === "all";
  const emp = everyone ? profile : (people.find(p => p.id === empId) ?? profile);
  const useMonth = !allMonths && month !== "";

  const rows = useMemo(() => {
    return plans
      .filter(p => {
        if (approvedOnly && p.approval_status !== "approved") return false;
        if (everyone) return true;
        const isController = p.controller_id === empId;
        const isMember = (p.work_plan_members ?? []).some(m => m.employee_id === empId);
        return isController || isMember;
      })
      .map(p => ({ plan: p, role: p.controller_id === empId ? "ผู้ควบคุมงาน" : "ผู้ปฏิบัติงาน" }));
  }, [plans, empId, everyone, approvedOnly]);

  const periodLabel = useMonth
    ? (() => { const [y, m] = month.split("-").map(Number); return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "long", year: "numeric" }); })()
    : "ทุกช่วงเวลา";

  function printSheet() {
    window.print();
  }

  function exportPdf() {
    const original = document.title;
    document.title = `ตารางงาน_${everyone ? "ทั้งทีม" : emp.employee_code}_${useMonth ? month : "ทั้งหมด"}`;
    window.addEventListener("afterprint", () => { document.title = original; }, { once: true });
    window.print();
  }

  return (
    <div>
      <div className="page-head no-print">
        <div>
          <h1>ตารางงานของฉัน</h1>
          <p className="muted" style={{ margin: 0 }}>{viewAll ? "เลือกดูและพิมพ์ตารางงานของพนักงานแต่ละคน หรือทั้งทีม" : "แผนงานที่คุณเป็นผู้ควบคุมงานหรือผู้ปฏิบัติงาน"}</p>
        </div>
      </div>

      <div className="sched-controls no-print">
        <div className="field">
          <label htmlFor="sc-emp">พนักงาน</label>
          {viewAll ? (
            <select id="sc-emp" value={empId} onChange={e => setEmpId(e.target.value)}>
              <option value={profile.id}>{profile.full_name} (ฉัน)</option>
              {profile.role === "admin" && <option value="all">ทุกคน (ทั้งทีม)</option>}
              {people.filter(p => p.id !== profile.id).map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.employee_code})</option>)}
            </select>
          ) : (
            <input id="sc-emp" readOnly value={`${profile.full_name} (${profile.employee_code})`} />
          )}
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
        <label className="check-inline">
          <input type="checkbox" checked={approvedOnly} onChange={e => setApprovedOnly(e.target.checked)} />
          เฉพาะที่อนุมัติแล้ว
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
            <div><b>ผู้ปฏิบัติงาน:</b> {everyone ? "ทุกคน (ทั้งทีม)" : `${emp.full_name} (${emp.employee_code})`}</div>
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
                  {!everyone && <th>บทบาท</th>}
                  <th>ผู้ควบคุมงาน</th>
                  <th>ทีมงาน</th>
                  <th>สถานะงาน</th>
                  <th>การอนุมัติ</th>
                  <th className="no-print">รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={everyone ? 10 : 11} style={{ textAlign: "center", padding: 28 }} className="muted">ไม่มีแผนงานในช่วงเวลานี้</td></tr>
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
                      {!everyone && <td>{role}</td>}
                      <td>{plan.controller?.full_name ?? "-"}</td>
                      <td>{team || "-"}</td>
                      <td><span className={`badge s-${plan.status}`} style={{ margin: 0 }}>{statusLabel(plan.status)}</span></td>
                      <td><span className="badge" style={{ margin: 0, background: approvalOf(plan).bg, color: approvalOf(plan).fg }}>{approvalOf(plan).label}</span></td>
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
            <div><div className="sign-name">(.......................................)</div><div className="sign-line" /><b>ผู้จัดทำ</b></div>
            <div><div className="sign-name">(.......................................)</div><div className="sign-line" /><b>ผู้ตรวจสอบ</b></div>
            <div><div className="sign-name">(.......................................)</div><div className="sign-line" /><b>ผู้อนุมัติ</b></div>
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
