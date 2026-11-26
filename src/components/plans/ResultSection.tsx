"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DateTime24 } from "@/components/ui/DateTime24";
import { RESULT_OUTCOMES, fmtDateTime } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan, WorkResult } from "@/types/plan";

type Supa = ReturnType<typeof createClient>;
type Outcome = WorkResult["outcome"];

const toLocal = (iso: string | null | undefined, fallback: string) => {
  const d = new Date(iso || fallback);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function ResultSection({ plan, profile, supabase, onSaved }: {
  plan: WorkPlan; profile: EmployeeProfile; supabase: Supa; onSaved: (r: WorkResult) => void;
}) {
  const res = plan.work_result ?? null;
  const [editing, setEditing] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(res?.outcome ?? "completed");
  const [summary, setSummary] = useState(res?.summary ?? "");
  const [issues, setIssues] = useState(res?.issues ?? "");
  const [start, setStart] = useState(toLocal(res?.actual_start, plan.start_at));
  const [end, setEnd] = useState(toLocal(res?.actual_end, plan.end_at));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const isMember = (plan.work_plan_members ?? []).some(m => m.employee_id === profile.id);
  const canRecord = profile.role === "admin" || plan.controller_id === profile.id || plan.created_by === profile.id || isMember;
  const eligible = plan.approval_status === "approved" && plan.status !== "cancelled" && new Date(plan.start_at).getTime() < Date.now();
  if (!eligible && !res) return null;

  async function save() {
    setErr("");
    if (new Date(end) < new Date(start)) { setErr("เวลาสิ้นสุดต้องไม่ก่อนเวลาเริ่ม"); return; }
    if (outcome !== "completed" && !issues.trim() && !summary.trim()) { setErr("กรุณาระบุผลที่เกิดขึ้นหรือปัญหา/อุปสรรค"); return; }
    setBusy(true);
    const row = {
      plan_id: plan.id, outcome, summary: summary.trim() || null, issues: issues.trim() || null,
      actual_start: outcome === "not_done" ? null : new Date(start).toISOString(),
      actual_end: outcome === "not_done" ? null : new Date(end).toISOString(),
      recorded_by: profile.id, recorded_at: new Date().toISOString()
    };
    const { error } = await supabase.from("work_results").upsert(row, { onConflict: "plan_id" });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setEditing(false);
    onSaved({ ...row, recorder: { id: profile.id, full_name: profile.full_name, employee_code: profile.employee_code } });
  }

  const meta = RESULT_OUTCOMES.find(o => o.value === res?.outcome);

  return (
    <section className="result-box" aria-label="บันทึกผลหลังปฏิบัติงาน">
      <div className="result-head">
        <b>📝 บันทึกผลหลังปฏิบัติงาน</b>
        {res && !editing && canRecord && <button type="button" className="link-btn" onClick={() => setEditing(true)}>แก้ไข</button>}
      </div>

      {res && !editing && (
        <div className="result-view">
          <span className={`result-badge r-${res.outcome}`}>{meta?.icon} {meta?.label}</span>
          {(res.actual_start || res.actual_end) && (
            <p className="muted">ปฏิบัติงานจริง {fmtDateTime(res.actual_start ?? plan.start_at)} – {fmtDateTime(res.actual_end ?? plan.end_at)}</p>
          )}
          {res.summary && <><div className="muted">ผลการปฏิบัติงาน</div><p className="detail-text">{res.summary}</p></>}
          {res.issues && <><div className="muted">ปัญหา / อุปสรรค</div><p className="detail-text">{res.issues}</p></>}
          <small className="muted">บันทึกโดย {res.recorder?.full_name ?? "-"} เมื่อ {fmtDateTime(res.recorded_at)}</small>
        </div>
      )}

      {!res && !editing && (
        canRecord
          ? <><p className="muted" style={{ margin: "0 0 10px" }}>งานนี้ผ่านวันเริ่มแล้วแต่ยังไม่มีบันทึกผล</p>
              <button type="button" className="btn" onClick={() => setEditing(true)}>บันทึกผลการปฏิบัติงาน</button></>
          : <p className="muted" style={{ margin: 0 }}>ยังไม่มีบันทึกผล (ผู้ควบคุมงาน/ทีมงานเป็นผู้บันทึก)</p>
      )}

      {editing && (
        <div className="result-form">
          <div className="result-outcomes" role="radiogroup" aria-label="ผลการปฏิบัติงาน">
            {RESULT_OUTCOMES.map(o => (
              <button key={o.value} type="button" role="radio" aria-checked={outcome === o.value}
                className={`result-opt r-${o.value}${outcome === o.value ? " on" : ""}`} onClick={() => setOutcome(o.value)}>
                {o.icon} {o.label}
              </button>
            ))}
          </div>
          {outcome !== "not_done" && (
            <div className="result-times">
              <div className="field"><label htmlFor="rs-start">เริ่มจริง</label><DateTime24 id="rs-start" value={start} onChange={setStart} required /></div>
              <div className="field"><label htmlFor="rs-end">เสร็จจริง</label><DateTime24 id="rs-end" value={end} onChange={setEnd} required /></div>
            </div>
          )}
          <div className="field">
            <label htmlFor="rs-sum">ผลการปฏิบัติงาน</label>
            <textarea id="rs-sum" value={summary} onChange={e => setSummary(e.target.value)} placeholder="เช่น เปลี่ยนสายไฟ 3 ช่วงเสา ตรวจวัดแรงดันปกติ" />
          </div>
          <div className="field">
            <label htmlFor="rs-iss">ปัญหา / อุปสรรค (ถ้ามี)</label>
            <textarea id="rs-iss" value={issues} onChange={e => setIssues(e.target.value)} placeholder="เช่น ฝนตก ทำให้ล่าช้า 1 ชม." />
          </div>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="chips">
            <button type="button" className="btn" disabled={busy} onClick={() => void save()}>{busy ? "กำลังบันทึก..." : "บันทึกผล"}</button>
            <button type="button" className="btn secondary" disabled={busy} onClick={() => { setEditing(false); setErr(""); }}>ยกเลิก</button>
          </div>
        </div>
      )}
    </section>
  );
}
