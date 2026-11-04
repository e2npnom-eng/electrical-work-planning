"use client";

import { useState } from "react";
import type { FormEvent, CSSProperties } from "react";
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
  const [status, setStatus] = useState(plan?.status ?? "planned");
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

  return <div style={overlay}>
    <section className="panel" style={modal}>
      <div className="toolbar">
        <h2 style={{ margin: 0 }}>{plan ? "แก้ไขแผนงาน" : "เพิ่มแผนงานใหม่"}</h2>
        <button className="btn secondary" type="button" onClick={onClose}>ปิด</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="field"><label>ชื่อแผนงาน *</label><input required value={title} onChange={e => setTitle(e.target.value)} /></div>
        <div className="field"><label>ผู้ควบคุมงาน *</label>
          <select required value={controllerId} onChange={e => setControllerId(e.target.value)}>
            <option value="">เลือกผู้ควบคุมงาน</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>)}
          </select>
        </div>
        <div className="field"><label>ทีมงาน / ผู้ปฏิบัติงาน</label>
          <div style={memberBox}>
            {employees.map(e => <label key={e.id} style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 400 }}>
              <input type="checkbox" checked={memberIds.includes(e.id)} onChange={() => toggleMember(e.id)} />
              {e.full_name} ({e.employee_code})
            </label>)}
          </div>
        </div>
        <div className="field"><label>สถานที่ปฏิบัติงาน *</label><input required value={location} onChange={e => setLocation(e.target.value)} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label>วันเวลาเริ่มต้น *</label><input required type="datetime-local" value={startAt} onChange={e => setStartAt(e.target.value)} /></div>
          <div className="field"><label>วันเวลาสิ้นสุด *</label><input required type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label>ประเภทงาน</label>
            <select value={workType} onChange={e => setWorkType(e.target.value)}>
              <option value="maintenance">บำรุงรักษา</option><option value="fault">แก้ไขเหตุขัดข้อง</option>
              <option value="construction">ก่อสร้าง / ติดตั้ง</option><option value="inspection">ตรวจสอบ</option><option value="other">อื่น ๆ</option>
            </select>
          </div>
          <div className="field"><label>สถานะ</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="planned">วางแผนแล้ว</option><option value="in_progress">กำลังดำเนินการ</option>
              <option value="completed">เสร็จสิ้น</option><option value="cancelled">ยกเลิก</option>
            </select>
          </div>
        </div>
        <div className="field"><label>รายละเอียดเพิ่มเติม</label><textarea value={description} onChange={e => setDescription(e.target.value)} /></div>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={saving} style={{ width: "100%" }}>{saving ? "กำลังบันทึก..." : "บันทึกแผนงาน"}</button>
      </form>
    </section>
  </div>;
}

const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,25,40,.55)", display: "grid", placeItems: "center", padding: 14 };
const modal: CSSProperties = { width: "100%", maxWidth: 680, maxHeight: "92vh", overflow: "auto" };
const memberBox: CSSProperties = { border: "1px solid #ccd6e2", borderRadius: 9, padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8, maxHeight: 140, overflow: "auto" };
