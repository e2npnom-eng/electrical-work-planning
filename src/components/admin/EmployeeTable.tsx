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
      <input type="search" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" aria-label="ค้นหา" value={q} onChange={e => setQ(e.target.value)} />
      <span className="muted">กดปุ่ม "ย้ายไป …" บนชื่อคนนั้น แล้วเขาจะย้ายไปอยู่ในช่องบทบาทใหม่ทันที</span>
    </div>
    {error && <p className="error" role="alert">{error}</p>}
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
                      <span className="role-move">
                        {COLUMNS.filter(c => c.role !== r.role).map(c => (
                          <button key={c.role} type="button" className={`move-btn move-${c.role}`} disabled={isMe || busy}
                            title={isMe ? "ไม่สามารถเปลี่ยนสิทธิ์ของตัวเองได้" : undefined}
                            onClick={() => void patch(r.id, { role: c.role })}>
                            ย้ายไป {ROLE_LABELS[c.role]}
                          </button>
                        ))}
                      </span>
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
