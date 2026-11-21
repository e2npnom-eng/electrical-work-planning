"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/plan-meta";
import type { Role } from "@/types/employee";

export type Row = {
  id: string; employee_code: string; full_name: string; role: Role; active: boolean; position?: string | null;
};

const COLUMNS: { role: Role; icon: string; desc: string }[] = [
  { role: "admin", icon: "🛡️", desc: "อนุมัติ/ยกเลิกแผนงาน จัดการสิทธิ์ทั้งระบบ" },
  { role: "executive", icon: "👔", desc: "ดูแผนงานของทุกคน (ไม่มีสิทธิ์อนุมัติ)" },
  { role: "employee", icon: "👷", desc: "วางแผนงานและดูแผนงานของตนเอง" }
];

export function EmployeeTable({ initial, meId }: { initial: Row[]; meId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");
  const [movedId, setMovedId] = useState("");
  const [adding, setAdding] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  const [notice, setNotice] = useState("");

  async function remove(r: Row) {
    setError(""); setSavingId(r.id);
    const { error: e } = await supabase.rpc("admin_delete_employee", { p_id: r.id });
    setSavingId(""); setConfirmId("");
    if (e) { setError(e.message); return; }
    setRows(cur => cur.filter(x => x.id !== r.id));
    setNotice(`ลบ ${r.full_name} แล้ว`);
  }

  async function patch(id: string, change: Partial<Pick<Row, "role" | "active">>) {
    setError(""); setSavingId(id);
    const { error: e } = await supabase.from("employees").update(change).eq("id", id);
    setSavingId("");
    if (e) { setError(e.message); return; }
    setRows(cur => cur.map(r => r.id === id ? { ...r, ...change } : r));
    if (change.role) { setMovedId(id); setTimeout(() => setMovedId(m => m === id ? "" : m), 1800); }
  }

  const needle = q.trim().toLowerCase();
  const match = (r: Row) => !needle || r.full_name.toLowerCase().includes(needle) || r.employee_code.toLowerCase().includes(needle);
  const byCode = (a: Row, b: Row) => a.employee_code.length - b.employee_code.length || a.employee_code.localeCompare(b.employee_code);

  return <>
    <div className="filters role-search">
      <button type="button" className="btn" onClick={() => { setNotice(""); setAdding(true); }}>＋ เพิ่มรายชื่อ</button>
      <input type="search" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" aria-label="ค้นหา" value={q} onChange={e => setQ(e.target.value)} />
      <span className="muted">เลือก "กำหนดบทบาท" ในการ์ดของแต่ละคน แล้วเขาจะย้ายไปอยู่ในช่องบทบาทนั้นทันที</span>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p className="note-box" role="status">{notice}</p>}
    {adding && <AddEmployeeDialog onClose={() => setAdding(false)} onCreated={(row) => {
      setRows(cur => [...cur, row]); setMovedId(row.id); setTimeout(() => setMovedId(m => m === row.id ? "" : m), 2500);
      setNotice(`เพิ่ม ${row.full_name} แล้ว · ชื่อผู้ใช้และรหัสผ่านเริ่มต้นคือ ${row.employee_code} (ให้เจ้าตัวเปลี่ยนรหัสผ่านหลังเข้าสู่ระบบ)`);
      setAdding(false);
    }} />}
    <div className="role-board">
      {COLUMNS.map(col => {
        const all = rows.filter(r => r.role === col.role).sort(byCode);
        const list = all.filter(match);
        return (
          <section key={col.role} className={`role-col role-col-${col.role}`} aria-label={ROLE_LABELS[col.role]}>
            <header className="role-col-head">
              <span className="role-col-ico" aria-hidden="true">{col.icon}</span>
              <div>
                <h2>{ROLE_LABELS[col.role]} <span className="role-count">{all.length}</span></h2>
                <p>{col.desc}</p>
              </div>
            </header>
            <div className="role-list">
              {list.length === 0 && <p className="muted role-empty">{needle ? "ไม่พบตามคำค้นหา" : "ยังไม่มีใครในบทบาทนี้"}</p>}
              {list.map(r => {
                const isMe = r.id === meId;
                const busy = savingId === r.id;
                return (
                  <article key={r.id} className={`role-card${r.active ? "" : " is-off"}${movedId === r.id ? " just-moved" : ""}`}>
                    <div className="role-card-top">
                      <span className="role-avatar" aria-hidden="true">{r.full_name.replace(/^(นาย|นางสาว|นาง)/, "").trim().charAt(0) || "•"}</span>
                      <div className="role-who">
                        <b>{r.full_name}{isMe && <small className="muted"> (ฉัน)</small>}</b>
                        <small className="muted">{r.employee_code}{r.position ? ` · ${r.position}` : ""}</small>
                      </div>
                    </div>
                    <div className="role-card-actions">
                      <label className="role-assign">
                        <span>กำหนดบทบาท</span>
                        <select value={r.role} disabled={isMe || busy} aria-label={`กำหนดบทบาทของ ${r.full_name}`}
                          title={isMe ? "ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้" : undefined}
                          onChange={e => void patch(r.id, { role: e.target.value as Role })}>
                          {COLUMNS.map(c => <option key={c.role} value={c.role}>{ROLE_LABELS[c.role]}</option>)}
                        </select>
                      </label>
                      {confirmId === r.id ? (
                        <span className="del-confirm" role="alert">
                          ลบ {r.full_name}?
                          <button type="button" className="del-yes" disabled={busy} onClick={() => void remove(r)}>ยืนยันลบ</button>
                          <button type="button" className="del-no" disabled={busy} onClick={() => setConfirmId("")}>ยกเลิก</button>
                        </span>
                      ) : (
                        <button type="button" className="del-btn" disabled={isMe || busy} aria-label={`ลบ ${r.full_name}`}
                          title={isMe ? "ไม่สามารถลบบัญชีของตัวเองได้" : "ลบรายชื่อ"} onClick={() => setConfirmId(r.id)}>🗑 ลบ</button>
                      )}
                      <button type="button" className={`active-switch${r.active ? " on" : ""}`} disabled={isMe || busy}
                        role="switch" aria-checked={r.active} aria-label={`เปิดใช้งานบัญชี ${r.full_name}`}
                        title={r.active ? "ใช้งานอยู่ (กดเพื่อปิดบัญชี)" : "ปิดใช้งาน (กดเพื่อเปิด)"}
                        onClick={() => void patch(r.id, { active: !r.active })}>
                        <i /><span>{r.active ? "ใช้งาน" : "ปิด"}</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  </>;
}

const PREFIXES = ["นาย", "นาง", "นางสาว"];

function AddEmployeeDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (row: Row) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [code, setCode] = useState("");
  const [prefix, setPrefix] = useState("นาย");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [position, setPosition] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<Role>("employee");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const c = code.trim();
    const name = `${prefix}${first.trim()} ${last.trim()}`.trim();
    if (c.length < 6) { setErr("รหัสพนักงานต้องมีอย่างน้อย 6 ตัวอักษร (ใช้เป็นรหัสผ่านเริ่มต้น)"); return; }
    setSaving(true);
    const { data, error: ex } = await supabase.rpc("admin_create_employee", {
      p_code: c, p_full_name: name, p_position: position.trim(), p_phone: phone.trim(), p_role: role
    });
    setSaving(false);
    if (ex) { setErr(ex.message); return; }
    onCreated({ id: data as string, employee_code: c, full_name: name, role, active: true, position: position.trim() || null });
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="เพิ่มรายชื่อ">
      <section className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h2>เพิ่มรายชื่อพนักงาน</h2>
          <button className="icon-btn" type="button" onClick={onClose} aria-label="ปิด">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="field"><label htmlFor="ae-code">รหัสพนักงาน *</label>
            <input id="ae-code" required inputMode="numeric" autoComplete="off" value={code} onChange={e => setCode(e.target.value)} />
            <small className="muted">ใช้เป็นชื่อผู้ใช้ และเป็นรหัสผ่านเริ่มต้น</small></div>
          <div className="two-col">
            <div className="field"><label htmlFor="ae-prefix">คำนำหน้า</label>
              <select id="ae-prefix" value={prefix} onChange={e => setPrefix(e.target.value)}>
                {PREFIXES.map(p => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div className="field"><label htmlFor="ae-role">บทบาท</label>
              <select id="ae-role" value={role} onChange={e => setRole(e.target.value as Role)}>
                {(Object.keys(ROLE_LABELS) as Role[]).map(k => <option key={k} value={k}>{ROLE_LABELS[k]}</option>)}
              </select></div>
          </div>
          <div className="two-col">
            <div className="field"><label htmlFor="ae-first">ชื่อ *</label>
              <input id="ae-first" required value={first} onChange={e => setFirst(e.target.value)} /></div>
            <div className="field"><label htmlFor="ae-last">สกุล *</label>
              <input id="ae-last" required value={last} onChange={e => setLast(e.target.value)} /></div>
          </div>
          <div className="field"><label htmlFor="ae-pos">ตำแหน่ง</label>
            <input id="ae-pos" value={position} onChange={e => setPosition(e.target.value)} /></div>
          <div className="field"><label htmlFor="ae-phone">เบอร์โทร</label>
            <input id="ae-phone" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} /></div>
          {err && <p className="error" role="alert">{err}</p>}
          <div className="modal-actions" style={{ marginTop: 8 }}>
            <button type="button" className="btn secondary" onClick={onClose}>ยกเลิก</button>
            <button className="btn" disabled={saving}>{saving ? "กำลังบันทึก…" : "เพิ่มรายชื่อ"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
