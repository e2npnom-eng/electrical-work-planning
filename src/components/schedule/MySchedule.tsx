"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PlanDetail } from "@/components/plans/PlanDetail";
import { PersonPicker } from "@/components/ui/PersonPicker";
import { PLAN_SELECT, approvalOf, byEmployeeCode, canViewAll, fmtDate, fmtTime } from "@/lib/plan-meta";
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
    void supabase.from("employees").select("id, employee_code, full_name, role, active, position")
      .eq("active", true).order("full_name")
      .then(({ data }) => { if (data) setPeople(byEmployeeCode(data as EmployeeProfile[])); });
  }, [supabase, viewAll]);

  useEffect(() => {
    if (!allMonths && month === "") return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      let query = supabase.from("work_plans").select(PLAN_SELECT).neq("status", "cancelled").order("start_at");
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
      });
  }, [plans, empId, everyone, approvedOnly]);

  // เลขลำดับเดิมคงไว้เสมอ (เลือกช่วง/ติ๊กเลือกแล้วเลขไม่เปลี่ยน)
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const shown = useMemo(() => {
    const from = Math.max(1, Number(rangeFrom) || 1);
    const to = Number(rangeTo) || Number.MAX_SAFE_INTEGER;
    return rows.map((plan, i) => ({ plan, no: i + 1 })).filter(r => r.no >= from && r.no <= to);
  }, [rows, rangeFrom, rangeTo]);
  const anyPicked = shown.some(r => picked.includes(r.plan.id));
  const printCount = anyPicked ? shown.filter(r => picked.includes(r.plan.id)).length : shown.length;
  const allShownPicked = shown.length > 0 && shown.every(r => picked.includes(r.plan.id));
  const rangeActive = rangeFrom !== "" || rangeTo !== "";

  function togglePick(id: string) {
    setPicked(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  }
  function toggleAllShown() {
    const ids = shown.map(r => r.plan.id);
    setPicked(cur => allShownPicked ? cur.filter(x => !ids.includes(x)) : Array.from(new Set([...cur, ...ids])));
  }

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

      <section className="sched-card no-print" aria-label="ตัวเลือกตารางงาน">
        <div className="sched-grid">
          <div className="field">
            <label htmlFor="sc-emp">พนักงาน</label>
            {viewAll ? (
              <PersonPicker id="sc-emp" ariaLabel="เลือกพนักงาน" value={empId} onChange={setEmpId} options={[
                { value: profile.id, label: profile.full_name, sub: `${profile.employee_code} · ฉัน`, pinned: true },
                ...(profile.role === "admin" ? [{ value: "all", label: "ทุกคน (ทั้งทีม)", sub: "ดูตารางงานรวมทั้งทีม", pinned: true }] : []),
                ...people.filter(p => p.id !== profile.id).map(p => ({ value: p.id, label: p.full_name, sub: `${p.employee_code}${p.position ? ` · ${p.position}` : ""}` }))
              ]} />
            ) : (
              <input id="sc-emp" readOnly value={`${profile.full_name} (${profile.employee_code})`} />
            )}
          </div>
          <div className="field">
            <label htmlFor="sc-month">เดือน</label>
            <input id="sc-month" type="month" value={month} disabled={allMonths}
              onChange={e => setMonth(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="sc-from">รายการที่ (ลำดับ)</label>
            <div className="range-row">
              <input id="sc-from" type="number" min={1} inputMode="numeric" placeholder="เริ่ม" aria-label="จากรายการที่" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} />
              <span>ถึง</span>
              <input type="number" min={1} inputMode="numeric" placeholder="สุดท้าย" aria-label="ถึงรายการที่" value={rangeTo} onChange={e => setRangeTo(e.target.value)} />
              {rangeActive && <button type="button" className="link-btn" onClick={() => { setRangeFrom(""); setRangeTo(""); }}>ล้าง</button>}
            </div>
          </div>
        </div>

        <div className="sched-bar">
          <div className="sched-chips">
            <label className={`toggle-chip${allMonths ? " on" : ""}`}>
              <input type="checkbox" checked={allMonths} onChange={e => setAllMonths(e.target.checked)} />
              <span>แสดงทุกเดือน</span>
            </label>
            <label className={`toggle-chip${approvedOnly ? " on" : ""}`}>
              <input type="checkbox" checked={approvedOnly} onChange={e => setApprovedOnly(e.target.checked)} />
              <span>เฉพาะที่อนุมัติแล้ว</span>
            </label>
            <span className="sched-count">{printCount} รายการ{anyPicked ? ` · ติ๊กพิมพ์ไว้ ${printCount}` : ""}
              {anyPicked && <button type="button" className="link-btn" onClick={() => setPicked([])}>ล้างที่ติ๊ก</button>}
            </span>
          </div>
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

        <p className="sched-tip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
          <span>ส่งออก PDF: เลือกเครื่องพิมพ์เป็น &ldquo;บันทึกเป็น PDF&rdquo; ในหน้าต่างพิมพ์ · พิมพ์เฉพาะบางรายการ: ใส่ช่วงลำดับ หรือติ๊กช่อง &ldquo;พิมพ์&rdquo; ท้ายแถว (ไม่ติ๊ก = พิมพ์ทั้งหมดที่แสดง)</span>
        </p>
      </section>

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
            <div><b>จำนวนแผนงาน:</b> {printCount} รายการ{(rangeActive || anyPicked) ? ` (จากทั้งหมด ${rows.length})` : ""}</div>
            <div><b>พิมพ์เมื่อ:</b> {fmtDate(new Date().toISOString())} {fmtTime(new Date().toISOString())} น.</div>
          </div>

          <div className="sched-cards no-print">
            {shown.length === 0 && <p className="muted" style={{ textAlign: "center", padding: 20 }}>ไม่มีแผนงานในช่วงเวลานี้</p>}
            {shown.map(({ plan, no }) => {
              const team = (plan.work_plan_members ?? []).map(m => m.employee?.full_name).filter(Boolean).join(", ");
              const sameDay = fmtDate(plan.start_at) === fmtDate(plan.end_at);
              const ap = approvalOf(plan);
              return (
                <article key={plan.id} className={`sc-card${anyPicked && !picked.includes(plan.id) ? " row-dim" : ""}`}>
                  <div className="sc-top">
                    <span className="sc-no">{String(no).padStart(3, "0")}</span>
                    <span className="badge" style={{ margin: 0, background: ap.bg, color: ap.fg }}>{ap.label}</span>
                    <label className="sc-pick"><input type="checkbox" className="pick-box" checked={picked.includes(plan.id)} onChange={() => togglePick(plan.id)} />พิมพ์</label>
                  </div>
                  <button type="button" className="sc-body" onClick={() => setSelected(plan)}>
                    <b className="sc-title">{plan.title}</b>
                    <span className="sc-line">🗓 {sameDay
                      ? `${fmtDate(plan.start_at)} · ${fmtTime(plan.start_at)}–${fmtTime(plan.end_at)} น.`
                      : `${fmtDate(plan.start_at)} ${fmtTime(plan.start_at)} – ${fmtDate(plan.end_at)} ${fmtTime(plan.end_at)} น.`}</span>
                    {plan.location && <span className="sc-line">📍 {plan.location}</span>}
                    <span className="sc-line">👤 {plan.controller?.full_name ?? "-"}{team ? ` · ทีม: ${team}` : ""}</span>
                    <span className="sc-more">ดูรายละเอียด ›</span>
                  </button>
                </article>
              );
            })}
          </div>

          <div className="sheet-table-wrap">
            <table className="sheet-table">
              <thead>
                <tr>
                  <th style={{ width: 44 }}>ที่</th>
                  <th>วันที่เริ่ม</th>
                  <th>วันที่สิ้นสุด</th>
                  <th className="col-title">ชื่อแผนงาน</th>
                  <th className="col-place">สถานที่</th>
                                    <th className="col-ctrl">ผู้ควบคุมงาน</th>
                  <th className="no-print">ทีมงาน</th>
                  <th>การอนุมัติ</th>
                  <th className="no-print">รายละเอียด</th>
                  <th className="no-print"><label className="pick-all"><input type="checkbox" checked={allShownPicked} onChange={toggleAllShown} />พิมพ์</label></th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: 28 }} className="muted">ไม่มีแผนงานในช่วงเวลานี้</td></tr>
                )}
                {shown.map(({ plan, no }) => {
                  const team = (plan.work_plan_members ?? []).map(m => m.employee?.full_name).filter(Boolean).join(", ");
                  return (
                    <tr key={plan.id} className={anyPicked && !picked.includes(plan.id) ? "no-print row-dim" : undefined}>
                      <td className="c" style={{ verticalAlign: "top" }}>{String(no).padStart(3, "0")}</td>
                      <td className="c" style={{ verticalAlign: "top" }}>{fmtDate(plan.start_at)}<br /><small>{fmtTime(plan.start_at)} น.</small></td>
                      <td className="c" style={{ verticalAlign: "top" }}>{fmtDate(plan.end_at)}<br /><small>{fmtTime(plan.end_at)} น.</small></td>
                      <td className="col-title" style={{ fontWeight: 600, verticalAlign: "top" }}>{plan.title}</td>
                      <td className="col-place" style={{ verticalAlign: "top" }}>{plan.location}</td>
                      <td className="col-ctrl" style={{ verticalAlign: "top" }}>{plan.controller?.full_name ?? "-"}</td>
                      <td className="no-print" style={{ verticalAlign: "top" }}>{team || "-"}</td>
                      <td className="c" style={{ verticalAlign: "top" }}><span className="badge" style={{ margin: 0, background: approvalOf(plan).bg, color: approvalOf(plan).fg }}>{approvalOf(plan).label}</span></td>
                      <td className="no-print" style={{ verticalAlign: "top" }}>
                        <button className="detail-btn" onClick={() => setSelected(plan)}>ดูรายละเอียด</button>
                      </td>
                      <td className="no-print c" style={{ verticalAlign: "top" }}>
                        <input type="checkbox" className="pick-box" aria-label={`พิมพ์รายการที่ ${no}`} checked={picked.includes(plan.id)} onChange={() => togglePick(plan.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sign-row">
            {["ผู้จัดทำ", "ผู้ตรวจสอบ", "ผู้อนุมัติ"].map(t => (
              <div className="sg" key={t}>
                <div className="sg-title">ลงนาม{t}</div>
                <div className="sg-row"><span className="sg-label">(ลงชื่อ)</span><span className="sg-fill" /><span /></div>
                <div className="sg-row"><span className="sg-label sg-open">(</span><span className="sg-fill" /><span className="sg-label sg-close">)</span></div>
                <div className="sg-row"><span className="sg-label">ตำแหน่ง</span><span className="sg-fill" /><span /></div>
                <div className="sg-row"><span className="sg-label">วันที่</span><span className="sg-date"><span className="sg-fill" /><i>/</i><span className="sg-fill" /><i>/</i><span className="sg-fill" /></span><span /></div>
              </div>
            ))}
          </div>
          <div className="print-footer">การไฟฟ้าส่วนภูมิภาคจังหวัดนครพนม</div>
        </section>
      )}

      {selected && <PlanDetail plan={selected} profile={profile}
        canEdit={false} canDelete={false}
        onResultSaved={r => setSelected(prev => prev ? { ...prev, work_result: r } : prev)}
        onClose={() => setSelected(null)} onEdit={() => undefined} onDelete={() => undefined} />}
    </div>
  );
}
