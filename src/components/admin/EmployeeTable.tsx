"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/plan-meta";
import type { Role } from "@/types/employee";

export type Row = { id: string; employee_code: string; full_name: string; role: Role; active: boolean };

export function EmployeeTable({ initial, meId }: { initial: Row[]; meId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState("");

  async function patch(id: string, change: Partial<Pick<Row, "role" | "active">>) {
    setError(""); setSavingId(id);
    const { error: e } = await supabase.from("employees").update(change).eq("id", id);
    setSavingId("");
    if (e) { setError(e.message); return; }
    setRows(cur => cur.map(r => r.id === id ? { ...r, ...change } : r));
  }

  const needle = q.trim().toLowerCase();
  const shown = needle ? rows.filter(r => r.full_name.toLowerCase().includes(needle) || r.employee_code.toLowerCase().includes(needle)) : rows;
  const count = (role: Role) => rows.filter(r => r.role === role).length;

  return <>
    <p className="muted">ผู้ดูแลระบบ {count("admin")} · ผู้บริหาร {count("executive")} · พนักงาน {count("employee")}</p>
    <div className="filters" style={{ marginBottom: 12 }}>
      <input type="search" placeholder="ค้นหาชื่อหรือรหัสพนักงาน" aria-label="ค้นหา" value={q} onChange={e => setQ(e.target.value)} />
    </div>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className="table-scroll">
        <div className="table-row table-head"><span>รหัสพนักงาน</span><span>ชื่อ-สกุล</span><span>สิทธิ์</span><span>สถานะ</span></div>
        {shown.map(r => (
          <div className="table-row" key={r.id}>
            <span style={{ fontWeight: 600 }}>{r.employee_code}</span>
            <span>{r.full_name}{r.id === meId && <small className="muted"> (ฉัน)</small>}</span>
            <span>
              <select aria-label={`สิทธิ์ของ ${r.full_name}`} className="row-select" value={r.role}
                disabled={r.id === meId || savingId === r.id}
                onChange={e => void patch(r.id, { role: e.target.value as Role })}>
                {(Object.keys(ROLE_LABELS) as Role[]).map(k => <option key={k} value={k}>{ROLE_LABELS[k]}</option>)}
              </select>
            </span>
            <span>
              <button className="detail-btn" disabled={r.id === meId || savingId === r.id}
                onClick={() => void patch(r.id, { active: !r.active })}>
                <i className="dot" style={{ background: r.active ? "#0F766E" : "#8A8299" }} />{r.active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  </>;
}
