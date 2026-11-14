"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";

export function ChangePasswordForm({ profile }: { profile: EmployeeProfile }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(""); setDone(false);
    if (next.length < 8) { setError("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร"); return; }
    if (next.toLowerCase() === profile.employee_code.toLowerCase()) { setError("รหัสผ่านใหม่ต้องไม่ตรงกับรหัสพนักงาน"); return; }
    if (next === current) { setError("รหัสผ่านใหม่ต้องไม่เหมือนรหัสผ่านเดิม"); return; }
    if (next !== confirm) { setError("ยืนยันรหัสผ่านใหม่ไม่ตรงกัน"); return; }
    setSaving(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: `${profile.employee_code.toLowerCase()}@login.electrical.local`, password: current
    });
    if (authError) { setSaving(false); setError("รหัสผ่านปัจจุบันไม่ถูกต้อง"); return; }
    const { error: updateError } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setCurrent(""); setNext(""); setConfirm(""); setDone(true);
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>บัญชีของฉัน</h1>
          <p className="muted" style={{ margin: 0 }}>{profile.full_name} · รหัส {profile.employee_code} · {ROLE_LABELS[profile.role]}</p>
        </div>
      </div>
      <section className="panel" style={{ maxWidth: 520 }}>
        <h2 style={{ marginTop: 0, fontSize: 22 }}>เปลี่ยนรหัสผ่าน</h2>
        <form onSubmit={handleSubmit}>
          <div className="field"><label htmlFor="cp-cur">รหัสผ่านปัจจุบัน</label>
            <input id="cp-cur" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} /></div>
          <div className="field"><label htmlFor="cp-new">รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</label>
            <input id="cp-new" type="password" autoComplete="new-password" required value={next} onChange={e => setNext(e.target.value)} /></div>
          <div className="field"><label htmlFor="cp-cf">ยืนยันรหัสผ่านใหม่</label>
            <input id="cp-cf" type="password" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
          {error && <p className="error" role="alert">{error}</p>}
          {done && <p className="ok-box" role="status">เปลี่ยนรหัสผ่านเรียบร้อย ใช้รหัสใหม่ในการเข้าสู่ระบบครั้งถัดไป</p>}
          <button className="btn" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}</button>
        </form>
      </section>
    </div>
  );
}
