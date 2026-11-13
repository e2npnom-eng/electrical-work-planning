"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan } from "@/types/plan";

type Props = {
  profile: EmployeeProfile;
  employees: EmployeeProfile[];
  plan: WorkPlan | null;
  onClose: () => void;
  onSaved: () => void;
};

type PlanStatus = WorkPlan["status"];

const WORK_TYPES: [string, string][] = [
  ["maintenance", "บำรุงรักษา"], ["fault", "แก้ไขเหตุขัดข้อง"],
  ["construction", "ก่อสร้าง / ติดตั้ง"], ["inspection", "ตรวจสอบ"], ["other", "อื่น ๆ"]
];
const STATUSES: [PlanStatus, string][] = [
  ["planned", "วางแผนแล้ว"], ["in_progress", "กำลังดำเนินการ"],
  ["completed", "เสร็จสิ้น"], ["cancelled", "ยกเลิก"]
];

function localDateTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function PlanForm({ profile, employees, plan, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(plan?.title ?? "");
  const [controllerId, setControllerId] = useState(plan?.controller_id ?? profile.id);
  const [location, setLocation] = useState(plan?.location ?? "");
  const [startAt, setStartAt] = useState(localDateTime(plan?.start_at));
  const [endAt, setEndAt] = useState(localDateTime(plan?.end_at));
  const [workType, setWorkType] = useState(plan?.work_type ?? "maintenance");
  const [description, setDescription] = useState(plan?.description ?? "");
  const [status, setStatus] = useState<PlanStatus>(plan?.status ?? "planned");
  const [memberIds, setMemberIds] = useState<string[]>(plan?.work_plan_members?.map(m => m.employee_id) ?? []);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function toggleMember(id: string) {
    setMemberIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (new Date(endAt) <= new Date(startAt)) {
      setError("เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const payload = {
      title: title.trim(), controller_id: controllerId, location: location.trim(),
      start_at: new Date(startAt).toISOString(), end_at: new Date(endAt).toISOString(),
      work_type: workType, description: description.trim(), status,
      ...(plan ? {} : { created_by: profile.id })
    };
    const result = plan
      ? await supabase.from("work_plans").update(payload).eq("id", plan.id).select("id").single()
      : await supabase.from("work_plans").insert(payload).select("id").single();

    if (result.error || !result.data) {
      setSaving(false);
      setError(result.error?.message ?? "ไม่สามารถบันทึกแผนงานได้");
      return;
    }

    const planId = plan?.id ?? result.data.id;
    const { error: removeError } = await supabase.from("work_plan_members").delete().eq("work_plan_id", planId);
    if (removeError) {
      setSaving(false); setError(removeError.message); return;
    }
    if (memberIds.length) {
      const { error: memberError } = await supabase.from("work_plan_members").insert(
        memberIds.map(employee_id => ({ work_plan_id: planId, employee_id }))
      );
      if (memberError) {
        setSaving(false); setError(memberError.message); return;
      }
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={plan ? "แก้ไขแผนงาน" : "เพิ่มแผนงานใหม่"}>
      <section className="modal">
        <div className="modal-head">
          <h2>{plan ? "แก้ไขแผนงาน" : "เพิ่มแผนงานใหม่"}</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="ปิด">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="field"><label htmlFor="pf-title">ชื่อแผนงาน *</label>
            <input id="pf-title" required value={title} onChange={e => setTitle(e.target.value)} /></div>
          <div className="two-col">
            <div className="field"><label htmlFor="pf-ctrl">ผู้ควบคุมงาน *</label>
              <select id="pf-ctrl" required value={controllerId} onChange={e => setControllerId(e.target.value)}>
                <option value="">เลือกผู้ควบคุมงาน</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
              </select>
            </div>
            <div className="field"><label htmlFor="pf-loc">สถานที่ปฏิบัติงาน *</label>
              <input id="pf-loc" required value={location} onChange={e => setLocation(e.target.value)} /></div>
            <div className="field"><label htmlFor="pf-start">วันเวลาเริ่มต้น *</label>
              <input id="pf-start" required type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} /></div>
            <div className="field"><label htmlFor="pf-end">วันเวลาสิ้นสุด *</label>
              <input id="pf-end" required type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} /></div>
          </div>
          <div className="field">
            <span className="field-label">ประเภทงาน</span>
            <div className="chips">
              {WORK_TYPES.map(([value, label]) => (
                <button type="button" key={value} className="choice" aria-pressed={workType === value}
                  onClick={() => setWorkType(value)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">สถานะ</span>
            <div className="chips">
              {STATUSES.map(([value, label]) => (
                <button type="button" key={value} className="choice" aria-pressed={status === value}
                  onClick={() => setStatus(value)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label">ทีมงาน / ผู้ปฏิบัติงาน</span>
            <div className="member-box">
              {employees.map(e => (
                <label key={e.id}>
                  <input type="checkbox" checked={memberIds.includes(e.id)} onChange={() => toggleMember(e.id)} />
                  {e.full_name} ({e.employee_code})
                </label>
              ))}
            </div>
          </div>
          <div className="field"><label htmlFor="pf-desc">รายละเอียดเพิ่มเติม</label>
            <textarea id="pf-desc" value={description} onChange={e => setDescription(e.target.value)} /></div>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={onClose}>ยกเลิก</button>
            <button className="btn" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกแผนงาน"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
