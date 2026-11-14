"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  APPROVALS, WORK_STATUSES, WORK_TYPES, fmtDateTime, localDateTime, shiftDate
} from "@/lib/plan-meta";
import type { Repeat } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { ApprovalStatus, Conflict, WorkPlan, WorkStatus } from "@/types/plan";

export type Prefill = {
  title?: string; controller_id?: string; location?: string; start_at?: string; end_at?: string;
  work_type?: string; description?: string; memberIds?: string[]; copied?: boolean;
};

type Props = {
  profile: EmployeeProfile;
  employees: EmployeeProfile[];
  plan: WorkPlan | null;
  prefill?: Prefill;
  onClose: () => void;
  onSaved: () => void;
};

const REPEATS: [Repeat, string][] = [
  ["none", "ไม่ซ้ำ"], ["weekly", "ทุกสัปดาห์"], ["biweekly", "ทุก 2 สัปดาห์"], ["monthly", "ทุกเดือน"]
];

export function PlanForm({ profile, employees, plan, prefill, onClose, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = profile.role === "admin";
  const init = plan
    ? {
        title: plan.title, controller_id: plan.controller_id, location: plan.location,
        start_at: plan.start_at, end_at: plan.end_at, work_type: plan.work_type ?? "maintenance",
        description: plan.description ?? "", memberIds: (plan.work_plan_members ?? []).map(m => m.employee_id)
      }
    : {
        title: prefill?.title ?? "", controller_id: prefill?.controller_id ?? profile.id,
        location: prefill?.location ?? "", start_at: prefill?.start_at, end_at: prefill?.end_at,
        work_type: prefill?.work_type ?? "maintenance", description: prefill?.description ?? "",
        memberIds: prefill?.memberIds ?? []
      };
  const originalMembers = useRef<string[]>(init.memberIds);

  const [title, setTitle] = useState(init.title);
  const [controllerId, setControllerId] = useState(init.controller_id);
  const [location, setLocation] = useState(init.location);
  const [startAt, setStartAt] = useState(localDateTime(init.start_at));
  const [endAt, setEndAt] = useState(localDateTime(init.end_at));
  const [workType, setWorkType] = useState(init.work_type);
  const [description, setDescription] = useState(init.description);
  const [status, setStatus] = useState<WorkStatus>(plan?.status ?? "planned");
  const [memberIds, setMemberIds] = useState<string[]>(init.memberIds);
  const [memberQuery, setMemberQuery] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [repeatCount, setRepeatCount] = useState(4);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [sameSite, setSameSite] = useState<WorkPlan[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const target = useRef<ApprovalStatus | null>(null);

  // ซ่อนคนที่ติดงานอื่นในช่วงเวลานี้ (ยกเว้นคนที่ถูกเลือกไว้แล้วในฟอร์มนี้)
  const available = employees.filter(e => !busyIds.includes(e.id) || memberIds.includes(e.id) || e.id === controllerId);
  const hiddenCount = employees.length - available.length;
  const q = memberQuery.trim().toLowerCase();
  const filteredEmployees = q
    ? available.filter(e => e.full_name.toLowerCase().includes(q) || e.employee_code.toLowerCase().includes(q))
    : available;

  function toggleMember(id: string) {
    setMemberIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  }

  useEffect(() => {
    if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) { setBusyIds([]); return; }
    const t = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("busy_people", {
        p_start: new Date(startAt).toISOString(), p_end: new Date(endAt).toISOString(), p_exclude: plan?.id ?? null
      });
      if (!rpcError) setBusyIds(((data ?? []) as { person_id: string }[]).map(r => r.person_id));
    }, 300);
    return () => clearTimeout(t);
  }, [supabase, startAt, endAt, plan?.id]);

  // สถานที่เดียวกัน เวลาทับกัน -> แจ้งว่าใครวางไว้ก่อน
  useEffect(() => {
    const loc = location.trim();
    if (!loc || !startAt || !endAt || new Date(endAt) <= new Date(startAt)) { setSameSite([]); return; }
    const t = setTimeout(async () => {
      let query = supabase.from("work_plans")
        .select("id, title, start_at, end_at, created_at, location, creator:employees!work_plans_created_by_fkey(id, full_name, employee_code)")
        .ilike("location", loc.replace(/[%_]/g, m => "\\" + m))
        .neq("status", "cancelled")
        .lt("start_at", new Date(endAt).toISOString()).gt("end_at", new Date(startAt).toISOString())
        .order("created_at");
      if (plan?.id) query = query.neq("id", plan.id);
      const { data, error: qError } = await query;
      if (!qError) setSameSite((data ?? []) as unknown as WorkPlan[]);
    }, 500);
    return () => clearTimeout(t);
  }, [supabase, location, startAt, endAt, plan?.id]);

  // ตรวจงานชนกัน (เตือนเฉยๆ ไม่บล็อกการบันทึก)
  useEffect(() => {
    if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) { setConflicts([]); return; }
    const people = Array.from(new Set([controllerId, ...memberIds].filter(Boolean)));
    if (!people.length) { setConflicts([]); return; }
    const t = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("find_conflicts", {
        p_start: new Date(startAt).toISOString(), p_end: new Date(endAt).toISOString(),
        p_people: people, p_exclude: plan?.id ?? null
      });
      if (!rpcError) setConflicts((data ?? []) as Conflict[]);
    }, 500);
    return () => clearTimeout(t);
  }, [supabase, startAt, endAt, controllerId, memberIds, plan?.id]);

  async function save(approvalTarget: ApprovalStatus | null) {
    setError("");
    if (new Date(endAt) <= new Date(startAt)) { setError("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น"); return; }
    setSaving(true);
    const base = {
      title: title.trim(), controller_id: controllerId, location: location.trim(),
      work_type: workType, description: description.trim(), status
    };
    let planIds: string[] = [];

    if (plan) {
      const patch = { ...base, start_at: new Date(startAt).toISOString(), end_at: new Date(endAt).toISOString(),
        ...(approvalTarget ? { approval_status: approvalTarget } : {}) };
      const res = await supabase.from("work_plans").update(patch).eq("id", plan.id).select("id").single();
      if (res.error || !res.data) { setSaving(false); setError(res.error?.message ?? "ไม่สามารถบันทึกแผนงานได้"); return; }
      planIds = [plan.id];
    } else {
      const s0 = new Date(startAt), e0 = new Date(endAt);
      const dur = e0.getTime() - s0.getTime();
      const times = repeat === "none" ? 1 : repeatCount;
      const group = times > 1 ? crypto.randomUUID() : null;
      const rows = Array.from({ length: times }, (_, i) => {
        const s = repeat === "none" ? s0 : shiftDate(s0, repeat, i);
        return {
          ...base, id: crypto.randomUUID(), created_by: profile.id,
          start_at: s.toISOString(), end_at: new Date(s.getTime() + dur).toISOString(),
          approval_status: approvalTarget ?? "draft", recurrence_group: group
        };
      });
      const res = await supabase.from("work_plans").insert(rows).select("id");
      if (res.error || !res.data) { setSaving(false); setError(res.error?.message ?? "ไม่สามารถบันทึกแผนงานได้"); return; }
      planIds = rows.map(r => r.id);
    }

    const before = [...originalMembers.current].sort().join(",");
    const after = [...memberIds].sort().join(",");
    if (!plan || before !== after) {
      if (plan) {
        const { error: removeError } = await supabase.from("work_plan_members").delete().eq("work_plan_id", plan.id);
        if (removeError) { setSaving(false); setError(removeError.message); return; }
      }
      if (memberIds.length) {
        const { error: memberError } = await supabase.from("work_plan_members").insert(
          planIds.flatMap(id => memberIds.map(employee_id => ({ work_plan_id: id, employee_id })))
        );
        if (memberError) {
          setSaving(false);
          window.alert("บันทึกแผนงานแล้ว แต่บันทึกทีมงานไม่สำเร็จ: " + memberError.message + "\nกรุณาเปิดแผนงานแล้วแก้ไขทีมงานอีกครั้ง");
          onSaved();
          return;
        }
      }
    }
    setSaving(false);
    onSaved();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save(target.current);
  }

  const cur = plan?.approval_status;
  const grouped = conflicts.reduce<Record<string, Conflict[]>>((acc, c) => {
    (acc[c.person_name] ??= []).push(c);
    return acc;
  }, {});

  const mode = plan ? "edit" : prefill?.copied ? "copy" : "new";
  const heading = mode === "edit" ? "แก้ไขแผนงาน" : mode === "copy" ? "คัดลอกแผนงาน" : "เพิ่มแผนงานใหม่";

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={heading}>
      <section className="modal">
        <div className="modal-head">
          <h2>{heading}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="ปิด">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        {mode === "copy" && <p className="note-box">คัดลอกข้อมูลมาให้แล้ว (เลื่อนไป 1 สัปดาห์) ตรวจสอบวันเวลาก่อนบันทึก</p>}
        <form onSubmit={handleSubmit}>
          <div className="field"><label htmlFor="pf-title">ชื่อแผนงาน *</label>
            <input id="pf-title" required value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="two-col">
            <div className="field"><label htmlFor="pf-ctrl">ผู้ควบคุมงาน *</label>
              <select id="pf-ctrl" required value={controllerId} onChange={e => setControllerId(e.target.value)}>
                <option value="">เลือกผู้ควบคุมงาน</option>
                {available.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="pf-loc">สถานที่ปฏิบัติงาน *</label>
              <input id="pf-loc" required value={location} onChange={e => setLocation(e.target.value)} /></div>
            <div className="field"><label htmlFor="pf-start">วันเวลาเริ่มต้น *</label>
              <input id="pf-start" required type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} /></div>
            <div className="field"><label htmlFor="pf-end">วันเวลาสิ้นสุด *</label>
              <input id="pf-end" required type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} /></div>
          </div>

          {conflicts.length > 0 && (
            <div className="warn-box" role="alert">
              <b>⚠ พบงานซ้อนกับแผนอื่น (บันทึกได้ แต่ควรตรวจสอบ)</b>
              <ul>
                {Object.entries(grouped).map(([name, list]) => (
                  <li key={name}><b>{name}</b>
                    {list.map(c => <div key={c.plan_id + c.person_id}>«{c.title}» {fmtDateTime(c.start_at)} – {fmtDateTime(c.end_at)}</div>)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sameSite.length > 0 && (
            <div className="warn-box" role="alert">
              <b>⚠ สถานที่เดียวกันมีแผนอื่นในช่วงเวลานี้ (บันทึกได้ แผนของคุณจะเป็นลำดับหลัง)</b>
              <ul>{sameSite.map(x => (
                <li key={x.id}>«{x.title}» {fmtDateTime(x.start_at)} – {fmtDateTime(x.end_at)} · วางโดย {x.creator?.full_name ?? "-"}</li>
              ))}</ul>
            </div>
          )}

          <div className="field">
            <span className="field-label">ประเภทงาน</span>
            <div className="chips">
              {WORK_TYPES.map(t => (
                <button type="button" key={t.value} className="choice" aria-pressed={workType === t.value}
                  onClick={() => setWorkType(t.value)}>{t.icon} {t.label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">สถานะงาน</span>
            <div className="chips">
              {WORK_STATUSES.map(s => (
                <button type="button" key={s.value} className="choice" aria-pressed={status === s.value}
                  onClick={() => setStatus(s.value)}>{s.label}</button>
              ))}
            </div>
          </div>

          {!plan && (
            <div className="field">
              <span className="field-label">ทำซ้ำ</span>
              <div className="chips">
                {REPEATS.map(([v, label]) => (
                  <button type="button" key={v} className="choice" aria-pressed={repeat === v}
                    onClick={() => setRepeat(v)}>{label}</button>
                ))}
              </div>
              {repeat !== "none" && (
                <div className="repeat-row">
                  <label htmlFor="pf-rc">จำนวนครั้งทั้งหมด</label>
                  <input id="pf-rc" type="number" min={2} max={12} value={repeatCount}
                    onChange={e => setRepeatCount(Math.min(12, Math.max(2, Number(e.target.value) || 2)))} />
                  <span className="muted">สร้างแผนงานแยกกัน {repeatCount} รายการ (ตรวจงานซ้อนเฉพาะครั้งแรก)</span>
                </div>
              )}
            </div>
          )}

          <div className="field">
            <div className="member-head">
              <span className="field-label">ทีมงาน / ผู้ปฏิบัติงาน</span>
              <span className="muted">
                เลือกแล้ว {memberIds.length} คน
                {memberIds.length > 0 && <>
                  {" · "}
                  <button type="button" className="link-btn" onClick={() => setMemberIds([])}>ล้างที่เลือก</button>
                </>}
              </span>
            </div>
            <input type="search" className="member-search" placeholder="ค้นหาชื่อหรือรหัสพนักงาน"
              aria-label="ค้นหาทีมงาน" value={memberQuery} onChange={e => setMemberQuery(e.target.value)} />
            {hiddenCount > 0 && <p className="muted" style={{ margin: "0 0 8px", fontSize: 13 }}>ซ่อน {hiddenCount} คนที่มีงานอื่นในช่วงเวลานี้แล้ว (ดูได้ในปฏิทิน)</p>}
            <div className="member-list" role="group" aria-label="รายชื่อทีมงาน">
              {filteredEmployees.length === 0 && <p className="muted" style={{ margin: 0, padding: 12 }}>ไม่พบรายชื่อที่ค้นหา</p>}
              {filteredEmployees.map(e => (
                <label key={e.id} className="member-item">
                  <input type="checkbox" checked={memberIds.includes(e.id)} onChange={() => toggleMember(e.id)} />
                  <span>{e.full_name}</span>
                  <small>{e.employee_code}</small>
                </label>
              ))}
            </div>
          </div>
          <div className="field"><label htmlFor="pf-desc">รายละเอียดเพิ่มเติม</label>
            <textarea id="pf-desc" value={description} onChange={e => setDescription(e.target.value)} /></div>

          {cur === "approved" && !isAdmin && (
            <p className="note-box">แผนนี้อนุมัติแล้ว หากแก้ชื่อ วันเวลา สถานที่ ผู้ควบคุม ประเภทงาน หรือทีมงาน แผนจะกลับไปสถานะ “{APPROVALS.pending.label}” เพื่อให้ผู้ดูแลอนุมัติใหม่</p>
          )}
          {cur === "returned" && plan?.review_note && (
            <p className="warn-box"><b>ผู้อนุมัติส่งกลับ:</b> {plan.review_note}</p>
          )}
          {error && <p className="error" role="alert">{error}</p>}

          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={onClose}>ยกเลิก</button>
            {(!plan || cur === "draft" || cur === "returned") && (
              <button className="btn secondary" disabled={saving} onClick={() => { target.current = "draft"; }}>
                {saving ? "กำลังบันทึก..." : "บันทึกร่าง"}
              </button>
            )}
            {(!plan || cur === "draft" || cur === "returned") && (
              isAdmin
                ? <button className="btn" disabled={saving} onClick={() => { target.current = "approved"; }}>บันทึกและอนุมัติ</button>
                : <button className="btn" disabled={saving} onClick={() => { target.current = "pending"; }}>ส่งขออนุมัติ</button>
            )}
            {plan && (cur === "pending" || cur === "approved") && (
              <button className="btn" disabled={saving} onClick={() => { target.current = null; }}>
                {saving ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </button>
            )}
            {plan && cur === "pending" && isAdmin && (
              <button className="btn" disabled={saving} onClick={() => { target.current = "approved"; }}>บันทึกและอนุมัติ</button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
