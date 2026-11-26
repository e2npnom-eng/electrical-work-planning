"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { PersonPicker } from "@/components/ui/PersonPicker";
import { DateTime24 } from "@/components/ui/DateTime24";
import {
  APPROVALS, WORK_TYPES, fmtDateTime, localDateTime, shiftDate
} from "@/lib/plan-meta";
import type { Repeat } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { ApprovalStatus, Conflict, Vehicle, WorkPlan } from "@/types/plan";

export type Prefill = {
  title?: string; controller_id?: string; location?: string; start_at?: string; end_at?: string;
  work_type?: string; description?: string; memberIds?: string[]; vehicleIds?: string[]; copied?: boolean;
};

type Props = {
  profile: EmployeeProfile;
  employees: EmployeeProfile[];
  vehicles: Vehicle[];
  plan: WorkPlan | null;
  prefill?: Prefill;
  onClose: () => void;
  onSaved: () => void;
};

const REPEATS: [Repeat, string][] = [
  ["none", "ไม่ซ้ำ"], ["weekly", "ทุกสัปดาห์"], ["biweekly", "ทุก 2 สัปดาห์"], ["monthly", "ทุกเดือน"]
];

export function PlanForm({ profile, employees, vehicles, plan, prefill, onClose, onSaved }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const isAdmin = profile.role === "admin";
  const init = plan
    ? {
        title: plan.title, controller_id: plan.controller_id, location: plan.location,
        start_at: plan.start_at, end_at: plan.end_at, work_type: plan.work_type ?? "maintenance",
        description: plan.description ?? "", memberIds: (plan.work_plan_members ?? []).map(m => m.employee_id),
        vehicleIds: (plan.work_plan_vehicles ?? []).map(v => v.vehicle_id)
      }
    : {
        title: prefill?.title ?? "", controller_id: prefill?.controller_id ?? profile.id,
        location: prefill?.location ?? "", start_at: prefill?.start_at, end_at: prefill?.end_at,
        work_type: prefill?.work_type ?? "maintenance", description: prefill?.description ?? "",
        memberIds: prefill?.memberIds ?? [], vehicleIds: prefill?.vehicleIds ?? []
      };
  const originalMembers = useRef<string[]>(init.memberIds);
  const originalVehicles = useRef<string[]>(init.vehicleIds);

  const [title, setTitle] = useState(init.title);
  const [controllerId, setControllerId] = useState(init.controller_id);
  const [location, setLocation] = useState(init.location);
  const [startAt, setStartAt] = useState(localDateTime(init.start_at));
  const [endAt, setEndAt] = useState(localDateTime(init.end_at));
  const [workType, setWorkType] = useState(init.work_type);
  const [description, setDescription] = useState(init.description);
  const [memberIds, setMemberIds] = useState<string[]>(init.memberIds);
  const [vehicleIds, setVehicleIds] = useState<string[]>(init.vehicleIds);
  const [busyVehicles, setBusyVehicles] = useState<Record<string, string>>({});
  const [memberQuery, setMemberQuery] = useState("");
  const [repeat, setRepeat] = useState<Repeat>("none");
  const [repeatCount, setRepeatCount] = useState(4);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [sameSite, setSameSite] = useState<WorkPlan[]>([]);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const o0 = plan?.outage ?? null;
  const [outOn, setOutOn] = useState(Boolean(o0));
  const [outFeeder, setOutFeeder] = useState(o0?.feeder ?? "");
  const [outArea, setOutArea] = useState(o0?.area ?? "");
  const [outCust, setOutCust] = useState(o0?.customers != null ? String(o0.customers) : "");
  const [outStart, setOutStart] = useState(o0 ? localDateTime(o0.outage_start) : "");
  const [outEnd, setOutEnd] = useState(o0 ? localDateTime(o0.outage_end) : "");
  const [outNotified, setOutNotified] = useState(o0?.notified ?? false);
  const [outNote, setOutNote] = useState(o0?.note ?? "");
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

  function toggleVehicle(id: string) {
    setVehicleIds(cur => cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  }

  // รถที่ถูกใช้ในช่วงเวลานี้แล้ว -> แสดงว่าใครใช้งานอะไร
  useEffect(() => {
    if (!startAt || !endAt || new Date(endAt) <= new Date(startAt)) { setBusyVehicles({}); return; }
    const t = setTimeout(async () => {
      const { data, error: rpcError } = await supabase.rpc("busy_vehicles", {
        p_start: new Date(startAt).toISOString(), p_end: new Date(endAt).toISOString(), p_exclude: plan?.id ?? null
      });
      if (rpcError) return;
      const m: Record<string, string> = {};
      for (const r of (data ?? []) as { vehicle_id: string; title: string }[]) m[r.vehicle_id] = m[r.vehicle_id] ? `${m[r.vehicle_id]}, ${r.title}` : r.title;
      setBusyVehicles(m);
    }, 300);
    return () => clearTimeout(t);
  }, [supabase, startAt, endAt, plan?.id]);

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
    if (!controllerId) { setError("กรุณาเลือกผู้ควบคุมงาน"); return; }
    if (new Date(endAt) <= new Date(startAt)) { setError("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น"); return; }
    if (outOn) {
      if (!outArea.trim()) { setError("กรุณาระบุพื้นที่ที่ไฟดับ"); return; }
      if (!outStart || !outEnd || new Date(outEnd) <= new Date(outStart)) { setError("เวลาไฟกลับต้องอยู่หลังเวลาดับไฟ"); return; }
    }
    setSaving(true);
    const base = {
      title: title.trim(), controller_id: controllerId, location: location.trim(),
      work_type: workType, description: description.trim()
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
          ...base, id: crypto.randomUUID(), created_by: profile.id, status: "planned",
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
    const vBefore = [...originalVehicles.current].sort().join(",");
    const vAfter = [...vehicleIds].sort().join(",");
    if (!plan || vBefore !== vAfter) {
      if (plan) {
        const { error: removeError } = await supabase.from("work_plan_vehicles").delete().eq("work_plan_id", plan.id);
        if (removeError) { setSaving(false); setError(removeError.message); return; }
      }
      if (vehicleIds.length) {
        const { error: vError } = await supabase.from("work_plan_vehicles").insert(
          planIds.flatMap(id => vehicleIds.map(vehicle_id => ({ work_plan_id: id, vehicle_id })))
        );
        if (vError) {
          setSaving(false);
          window.alert("บันทึกแผนงานแล้ว แต่บันทึกรถไม่สำเร็จ: " + vError.message + "\nกรุณาเปิดแผนงานแล้วแก้ไขรถอีกครั้ง");
          onSaved();
          return;
        }
      }
    }
    // แผนดับไฟ (งานซ้ำ: เลื่อนเวลาดับไฟตามวันของแต่ละรอบ)
    if (outOn) {
      const baseStart = new Date(startAt).getTime();
      const rows = planIds.map((id, i) => {
        const shift = plan ? 0 : (repeat === "none" ? 0 : shiftDate(new Date(startAt), repeat, i).getTime() - baseStart);
        return {
          plan_id: id, feeder: outFeeder.trim() || null, area: outArea.trim(),
          customers: outCust.trim() === "" ? null : Math.max(0, Math.round(Number(outCust)) || 0),
          outage_start: new Date(new Date(outStart).getTime() + shift).toISOString(),
          outage_end: new Date(new Date(outEnd).getTime() + shift).toISOString(),
          notified: outNotified, note: outNote.trim() || null
        };
      });
      const { error: oErr } = await supabase.from("outage_plans").upsert(rows, { onConflict: "plan_id" });
      if (oErr) {
        setSaving(false);
        window.alert("บันทึกแผนงานแล้ว แต่บันทึกแผนดับไฟไม่สำเร็จ: " + oErr.message + "\nกรุณาเปิดแผนงานแล้วแก้ไขอีกครั้ง");
        onSaved();
        return;
      }
    } else if (plan?.outage) {
      const { error: oErr } = await supabase.from("outage_plans").delete().eq("plan_id", plan.id);
      if (oErr) { setSaving(false); setError(oErr.message); return; }
    }
    setSaving(false);
    onSaved();
  }

  function toggleOutage(on: boolean) {
    setOutOn(on);
    if (on) {
      if (!outStart) setOutStart(startAt);
      if (!outEnd) setOutEnd(endAt);
    }
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
              <PersonPicker className="pf-picker" id="pf-ctrl" ariaLabel="เลือกผู้ควบคุมงาน" value={controllerId} onChange={setControllerId}
                options={[
                  ...available.filter(e => e.id === profile.id).map(e => ({ value: e.id, label: e.full_name, sub: `${e.employee_code} · ฉัน`, pinned: true })),
                  ...available.filter(e => e.id !== profile.id).map(e => ({ value: e.id, label: e.full_name, sub: `${e.employee_code}${e.position ? ` · ${e.position}` : ""}` }))
                ]} />
            </div>
            <div className="field"><label htmlFor="pf-loc">สถานที่ปฏิบัติงาน *</label>
              <input id="pf-loc" required value={location} onChange={e => setLocation(e.target.value)} /></div>
            <div className="field"><label htmlFor="pf-start">วันเวลาเริ่มต้น *</label>
              <DateTime24 id="pf-start" required value={startAt} onChange={setStartAt} /></div>
            <div className="field"><label htmlFor="pf-end">วันเวลาสิ้นสุด *</label>
              <DateTime24 id="pf-end" required value={endAt} onChange={setEndAt} /></div>
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
          {vehicles.length > 0 && (
            <div className="field">
              <div className="member-head">
                <span className="field-label">รถที่ใช้งาน</span>
                <span className="muted">
                  เลือกแล้ว {vehicleIds.length} คัน
                  {vehicleIds.length > 0 && <>{" · "}<button type="button" className="link-btn" onClick={() => setVehicleIds([])}>ล้างที่เลือก</button></>}
                </span>
              </div>
              <div className="member-list vehicle-list" role="group" aria-label="รถที่ใช้งาน">
                {vehicles.map(v => {
                  const used = busyVehicles[v.id];
                  const checked = vehicleIds.includes(v.id);
                  return (
                    <label key={v.id} className={`member-item${used && !checked ? " is-busy" : ""}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleVehicle(v.id)} />
                      <span>🚗 {v.code}</span>
                      {v.plate && <small>{v.plate}</small>}
                      {used && <em className="veh-used">ถูกใช้แล้ว: {used}</em>}
                    </label>
                  );
                })}
              </div>
              {vehicleIds.some(id => busyVehicles[id]) && (
                <p className="warn-box" style={{ marginTop: 8 }}>รถที่เลือกมีแผนงานอื่นใช้ในช่วงเวลานี้ — บันทึกได้ แต่ควรตรวจสอบกับผู้เกี่ยวข้อง</p>
              )}
            </div>
          )}
          <div className="field"><label htmlFor="pf-desc">รายละเอียดเพิ่มเติม</label>
            <textarea id="pf-desc" value={description} onChange={e => setDescription(e.target.value)} /></div>

          <fieldset className={`outage-box${outOn ? " on" : ""}`}>
            <legend className="sr-only">แผนดับไฟ</legend>
            <label className="outage-toggle">
              <input type="checkbox" checked={outOn} onChange={e => toggleOutage(e.target.checked)} />
              <span>⚡ งานนี้มีการดับไฟ</span>
            </label>
            {outOn && (
              <div className="outage-fields">
                <div className="field"><label htmlFor="of-area">พื้นที่ที่ไฟดับ *</label>
                  <input id="of-area" value={outArea} onChange={e => setOutArea(e.target.value)} placeholder="เช่น บ้านหนองแสง หมู่ 3, 5" /></div>
                <div className="outage-row">
                  <div className="field"><label htmlFor="of-feeder">ฟีดเดอร์ / จุดตัดไฟ</label>
                    <input id="of-feeder" value={outFeeder} onChange={e => setOutFeeder(e.target.value)} placeholder="เช่น NPM-01" /></div>
                  <div className="field"><label htmlFor="of-cust">ผู้ใช้ไฟที่ได้รับผลกระทบ (ราย)</label>
                    <input id="of-cust" type="number" min={0} inputMode="numeric" value={outCust} onChange={e => setOutCust(e.target.value)} /></div>
                </div>
                <div className="outage-row">
                  <div className="field"><label htmlFor="of-start">ดับไฟ</label><DateTime24 id="of-start" value={outStart} onChange={setOutStart} required /></div>
                  <div className="field"><label htmlFor="of-end">ไฟกลับ</label><DateTime24 id="of-end" value={outEnd} onChange={setOutEnd} required /></div>
                </div>
                <label className="outage-toggle">
                  <input type="checkbox" checked={outNotified} onChange={e => setOutNotified(e.target.checked)} />
                  <span>แจ้งผู้ใช้ไฟแล้ว</span>
                </label>
                <div className="field"><label htmlFor="of-note">หมายเหตุ</label>
                  <input id="of-note" value={outNote} onChange={e => setOutNote(e.target.value)} /></div>
              </div>
            )}
          </fieldset>

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
