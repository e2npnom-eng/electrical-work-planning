"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/plan-meta";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import type { EmployeeProfile } from "@/types/employee";

type Extra = { position: string; phone: string };

export function ProfilePage({ profile, extra }: { profile: EmployeeProfile; extra: Extra }) {
  const supabase = createClient();
  const [saved, setSaved] = useState({ full_name: profile.full_name, ...extra });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(saved.full_name);
  const [position, setPosition] = useState(saved.position);
  const [phone, setPhone] = useState(saved.phone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [pwOpen, setPwOpen] = useState(false);

  function startEdit() { setName(saved.full_name); setPosition(saved.position); setPhone(saved.phone); setError(""); setMsg(""); setEditing(true); }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    if (!name.trim()) { setError("กรุณากรอกชื่อ-นามสกุล"); return; }
    if (phone.trim() && !/^[0-9+\-\s()]{6,20}$/.test(phone.trim())) { setError("เบอร์โทรศัพท์ไม่ถูกต้อง"); return; }
    setSaving(true);
    const { error: rpcError } = await supabase.rpc("update_my_profile", {
      p_full_name: name.trim(), p_position: position.trim(), p_phone: phone.trim()
    });
    setSaving(false);
    if (rpcError) { setError(rpcError.message); return; }
    setSaved({ full_name: name.trim(), position: position.trim(), phone: phone.trim() });
    setEditing(false);
    setMsg("บันทึกข้อมูลเรียบร้อย");
  }

  const initial = saved.full_name.trim().charAt(0) || "?";

  return (
    <div className="profile-wrap">
      <div className="page-head">
        <div>
          <h1>ข้อมูลส่วนตัว</h1>
          <p className="muted" style={{ margin: 0, fontSize: 14 }}>ข้อมูลของคุณที่ใช้แสดงในระบบและเอกสารพิมพ์</p>
        </div>
      </div>

      <section className="panel profile-card">
        <div className="profile-top">
          <span className="profile-avatar" aria-hidden="true">{initial}</span>
          <div className="profile-id">
            <h2>{saved.full_name}</h2>
            <div className="profile-tags">
              <span className={`role-pill role-${profile.role}`}>{ROLE_LABELS[profile.role]}</span>
              <span className="muted">รหัสพนักงาน {profile.employee_code}</span>
            </div>
          </div>
          {!editing && (
            <button className="btn secondary profile-edit-btn" onClick={startEdit}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              แก้ไขข้อมูล
            </button>
          )}
        </div>

        {msg && !editing && <p className="ok-box" role="status">{msg}</p>}

        {!editing ? (
          <dl className="profile-grid">
            <div><dt>ชื่อ-นามสกุล</dt><dd>{saved.full_name}</dd></div>
            <div><dt>รหัสพนักงาน</dt><dd>{profile.employee_code}</dd></div>
            <div><dt>ตำแหน่ง</dt><dd>{saved.position || <span className="muted">ยังไม่ได้ระบุ</span>}</dd></div>
            <div><dt>เบอร์โทรศัพท์</dt><dd>{saved.phone || <span className="muted">ยังไม่ได้ระบุ</span>}</dd></div>
            <div><dt>บทบาทในระบบ</dt><dd>{ROLE_LABELS[profile.role]}</dd></div>
            <div><dt>สถานะบัญชี</dt><dd><span className="status-ok">● ใช้งานอยู่</span></dd></div>
          </dl>
        ) : (
          <form onSubmit={save} className="profile-form">
            <div className="profile-grid">
              <div className="field"><label htmlFor="pr-name">ชื่อ-นามสกุล</label>
                <input id="pr-name" value={name} onChange={e => setName(e.target.value)} required maxLength={120} /></div>
              <div className="field"><label htmlFor="pr-code">รหัสพนักงาน</label>
                <input id="pr-code" value={profile.employee_code} disabled /></div>
              <div className="field"><label htmlFor="pr-pos">ตำแหน่ง</label>
                <input id="pr-pos" value={position} onChange={e => setPosition(e.target.value)} maxLength={120} placeholder="เช่น พนักงานไฟฟ้า ระดับ 4" /></div>
              <div className="field"><label htmlFor="pr-phone">เบอร์โทรศัพท์</label>
                <input id="pr-phone" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} placeholder="เช่น 08x-xxx-xxxx" /></div>
            </div>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 12px" }}>รหัสพนักงานและบทบาทแก้ไขเองไม่ได้ หากต้องการเปลี่ยนให้ติดต่อผู้ดูแลระบบ</p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="chips">
              <button className="btn" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</button>
              <button type="button" className="btn secondary" disabled={saving} onClick={() => setEditing(false)}>ยกเลิก</button>
            </div>
          </form>
        )}
      </section>

      <section className="panel profile-card">
        <div className="security-row">
          <span className="security-ico" aria-hidden="true">🔒</span>
          <div className="security-text">
            <h3>รหัสผ่าน</h3>
            <p className="muted">••••••••• · แนะนำให้เปลี่ยนรหัสผ่านเป็นประจำ</p>
          </div>
          <button className="btn secondary" onClick={() => setPwOpen(o => !o)} aria-expanded={pwOpen}>
            {pwOpen ? "ปิด" : "เปลี่ยนรหัสผ่าน"}
          </button>
        </div>
        {pwOpen && (
          <div className="security-form">
            <ChangePasswordForm profile={profile} embedded onDone={() => { /* คงฟอร์มไว้เพื่อแสดงข้อความสำเร็จ */ }} />
          </div>
        )}
      </section>
    </div>
  );
}
