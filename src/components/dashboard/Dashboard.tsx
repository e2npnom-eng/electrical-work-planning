"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PersonPicker } from "@/components/ui/PersonPicker";
import { APPROVALS, PLAN_SELECT, WORK_TYPES, byEmployeeCode, canViewAll, fmtDate, fmtTime, isPastPlan, needsResult } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan } from "@/types/plan";

type Period = "month" | "lastMonth" | "quarter" | "year";
const PERIODS: { value: Period; label: string }[] = [
  { value: "month", label: "เดือนนี้" },
  { value: "lastMonth", label: "เดือนก่อน" },
  { value: "quarter", label: "3 เดือน" },
  { value: "year", label: "ปีนี้" }
];
const CANCEL_COLOR = "#A39BB5";
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function rangeOf(p: Period) {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth();
  if (p === "month") return { from: new Date(y, m, 1), to: new Date(y, m + 1, 1), bucket: "day" as const };
  if (p === "lastMonth") return { from: new Date(y, m - 1, 1), to: new Date(y, m, 1), bucket: "day" as const };
  if (p === "quarter") return { from: new Date(y, m - 2, 1), to: new Date(y, m + 1, 1), bucket: "month" as const };
  return { from: new Date(y, 0, 1), to: new Date(y + 1, 0, 1), bucket: "month" as const };
}
const thYear = (d: Date) => d.getFullYear() + 543;
const nf = (n: number) => n.toLocaleString("th-TH");

export function Dashboard({ profile }: { profile: EmployeeProfile }) {
  const supabase = useMemo(() => createClient(), []);
  const viewAll = canViewAll(profile.role);
  const [period, setPeriod] = useState<Period>("month");
  const [who, setWho] = useState("all");
  const [people, setPeople] = useState<EmployeeProfile[]>([]);
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [upcoming, setUpcoming] = useState<WorkPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const { from, to, bucket } = useMemo(() => rangeOf(period), [period]);

  useEffect(() => {
    if (!viewAll) return;
    void supabase.from("employees").select("id, employee_code, full_name, role, active, position")
      .eq("active", true).then(({ data }) => { if (data) setPeople(byEmployeeCode(data as EmployeeProfile[])); });
  }, [supabase, viewAll]);

  useEffect(() => {
    let off = false;
    setLoading(true); setError("");
    void (async () => {
      const [a, b] = await Promise.all([
        supabase.from("work_plans").select(PLAN_SELECT)
          .lt("start_at", to.toISOString()).gt("end_at", from.toISOString()).order("start_at"),
        supabase.from("work_plans").select(PLAN_SELECT)
          .gte("start_at", new Date().toISOString()).neq("status", "cancelled").order("start_at").limit(80)
      ]);
      if (off) return;
      if (a.error) setError(a.error.message);
      setPlans((a.data ?? []) as unknown as WorkPlan[]);
      setUpcoming((b.data ?? []) as unknown as WorkPlan[]);
      setLoading(false);
    })();
    return () => { off = true; };
  }, [supabase, from, to]);

  const personId = viewAll ? (who === "all" ? null : who) : profile.id;
  const inScope = (p: WorkPlan) => !personId || p.controller_id === personId || (p.work_plan_members ?? []).some(m => m.employee_id === personId);

  const d = useMemo(() => {
    const all = plans.filter(p => inScope(p) && new Date(p.start_at) >= from && new Date(p.start_at) < to);
    const cancelled = all.filter(p => p.status === "cancelled");
    const act = all.filter(p => p.status !== "cancelled");
    const cnt = (k: string) => act.filter(p => p.approval_status === k).length;
    const overdue = act.filter(p => p.approval_status !== "approved" && isPastPlan(p)).length;
    const noResult = act.filter(needsResult).length;

    // แนวโน้ม
    const n = bucket === "day" ? Math.round((to.getTime() - from.getTime()) / 86400000) : (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth();
    const trend = Array.from({ length: n }, (_, i) => {
      const s = bucket === "day" ? new Date(from.getFullYear(), from.getMonth(), from.getDate() + i) : new Date(from.getFullYear(), from.getMonth() + i, 1);
      return { label: bucket === "day" ? String(s.getDate()) : TH_MONTH[s.getMonth()], full: bucket === "day" ? fmtDate(s.toISOString()) : `${TH_MONTH[s.getMonth()]} ${thYear(s)}`, value: 0 };
    });
    for (const p of act) {
      const s = new Date(p.start_at);
      const i = bucket === "day" ? s.getDate() - 1 : (s.getFullYear() - from.getFullYear()) * 12 + s.getMonth() - from.getMonth();
      if (trend[i]) trend[i].value++;
    }
    // ประเภทงาน
    const types = WORK_TYPES.map(t => ({ label: `${t.icon} ${t.label}`, value: act.filter(p => (p.work_type ?? "other") === t.value).length }))
      .sort((a, b) => b.value - a.value);
    // รถ
    const vmap = new Map<string, { label: string; value: number }>();
    for (const p of act) for (const v of p.work_plan_vehicles ?? []) {
      const key = v.vehicle_id; const cur = vmap.get(key) ?? { label: v.vehicle?.code ?? "-", value: 0 };
      cur.value++; vmap.set(key, cur);
    }
    const vehicles = [...vmap.values()].sort((a, b) => b.value - a.value).slice(0, 8);
    // รายบุคคล
    const pmap = new Map<string, { label: string; value: number }>();
    for (const p of act) {
      const ids = new Map<string, string>();
      if (p.controller) ids.set(p.controller.id, p.controller.full_name);
      for (const m of p.work_plan_members ?? []) if (m.employee) ids.set(m.employee.id, m.employee.full_name);
      ids.forEach((name, id) => { const cur = pmap.get(id) ?? { label: name, value: 0 }; cur.value++; pmap.set(id, cur); });
    }
    const ranking = [...pmap.values()].sort((a, b) => b.value - a.value).slice(0, 10);
    return {
      total: act.length, approved: cnt("approved"), pending: cnt("pending"), returned: cnt("returned"), draft: cnt("draft"),
      cancelled: cancelled.length, overdue, noResult, trend, types, vehicles, ranking
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, personId, from, to, bucket]);

  const next5 = useMemo(() => upcoming.filter(inScope).slice(0, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcoming, personId]);

  const outages = useMemo(() => upcoming.filter(p => p.outage && p.approval_status !== "draft").filter(inScope),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcoming, personId]);
  const outCustomers = outages.reduce((sum, p) => sum + (p.outage?.customers ?? 0), 0);
  const outUnnotified = outages.filter(p => !p.outage?.notified).length;

  const periodLabel = period === "year" ? `ปี ${thYear(from)}`
    : bucket === "month" ? `${TH_MONTH[from.getMonth()]} – ${TH_MONTH[to.getMonth() === 0 ? 11 : to.getMonth() - 1]} ${thYear(from)}`
      : `${TH_MONTH[from.getMonth()]} ${thYear(from)}`;
  const pct = (v: number) => d.total ? Math.round((v / d.total) * 100) : 0;
  const whoName = personId ? (personId === profile.id ? "ของฉัน" : people.find(p => p.id === personId)?.full_name ?? "") : "ทุกคน";

  const statusParts = [
    { key: "approved", label: APPROVALS.approved.label, color: APPROVALS.approved.solid, v: d.approved },
    { key: "pending", label: APPROVALS.pending.label, color: APPROVALS.pending.solid, v: d.pending },
    { key: "returned", label: APPROVALS.returned.label, color: APPROVALS.returned.solid, v: d.returned },
    { key: "draft", label: APPROVALS.draft.label, color: APPROVALS.draft.solid, v: d.draft },
    { key: "cancelled", label: "ยกเลิก", color: CANCEL_COLOR, v: d.cancelled }
  ];
  const statusTotal = statusParts.reduce((s, x) => s + x.v, 0);

  return (
    <div className="db">
      <div className="page-head">
        <div>
          <h1>แดชบอร์ด</h1>
          <p className="muted" style={{ margin: 0 }}>
            {viewAll ? "ภาพรวมแผนงานของทุกคน เลือกดูรายบุคคลได้" : "ภาพรวมแผนงานของคุณเอง (ผู้ควบคุมงานหรือผู้ปฏิบัติงาน)"} · {periodLabel}
          </p>
        </div>
        <div className="head-actions">
          {viewAll && (
            <PersonPicker className="db-select" ariaLabel="เลือกพนักงาน" value={who} onChange={setWho} options={[
              { value: "all", label: "ทุกคน", sub: "ภาพรวมทั้งทีม", pinned: true },
              { value: profile.id, label: profile.full_name, sub: `${profile.employee_code} · ฉัน`, pinned: true },
              ...people.filter(p => p.id !== profile.id).map(p => ({ value: p.id, label: p.full_name, sub: `${p.employee_code}${p.position ? ` · ${p.position}` : ""}` }))
            ]} />
          )}
          <div className="seg" role="group" aria-label="ช่วงเวลา">
            {PERIODS.map(p => <button key={p.value} type="button" aria-pressed={period === p.value} onClick={() => setPeriod(p.value)}>{p.label}</button>)}
          </div>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <section className="db-kpis" aria-label="สรุปตัวเลข" aria-busy={loading}>
        <Kpi label="แผนงานทั้งหมด" value={d.total} hint={whoName} tone="brand" />
        <Kpi label="อนุมัติแล้ว" value={d.approved} hint={`${pct(d.approved)}% ของทั้งหมด`} color={APPROVALS.approved.solid} />
        <Kpi label="รออนุมัติ" value={d.pending} hint={d.pending ? "รอผู้ดูแลระบบ" : "ไม่มีรายการค้าง"} color={APPROVALS.pending.solid} />
        <Kpi label="ส่งกลับแก้ไข" value={d.returned} hint={d.returned ? "ต้องแก้ไขแล้วส่งใหม่" : "-"} color={APPROVALS.returned.solid} />
        <Kpi label="ยกเลิก" value={d.cancelled} hint="ไม่นับในแผนงานทั้งหมด" color={CANCEL_COLOR} />
        <Kpi label="รอบันทึกผล" value={d.noResult} hint={d.noResult ? "งานเสร็จแล้วยังไม่บันทึกผล" : "บันทึกครบแล้ว"} color={d.noResult ? "#B7791F" : "#7C7491"} />
        <Kpi label="ผ่านวันแล้วยังไม่อนุมัติ" value={d.overdue} hint={d.overdue ? "❗ ควรติดตาม" : "ไม่มี"} color={d.overdue ? "#B42318" : "#7C7491"} />
      </section>

      <div className="db-grid">
        <section className="panel db-trend-panel">
          <h2>{bucket === "day" ? "จำนวนแผนงานรายวัน" : "จำนวนแผนงานรายเดือน"}</h2>
          <p className="muted db-sub">นับตามวันเริ่มงาน ไม่รวมที่ยกเลิก</p>
          <TrendChart data={d.trend} unit={bucket === "day" ? "วันที่" : ""} />
          <details className="db-table">
            <summary>ดูเป็นตาราง</summary>
            <table><thead><tr><th>{bucket === "day" ? "วันที่" : "เดือน"}</th><th>แผนงาน</th></tr></thead>
              <tbody>{d.trend.filter(t => t.value > 0).map(t => <tr key={t.full}><td>{t.full}</td><td>{t.value}</td></tr>)}
                {d.total === 0 && <tr><td colSpan={2}>ไม่มีข้อมูล</td></tr>}</tbody></table>
          </details>
        </section>

        <section className="panel">
          <h2>สถานะการอนุมัติ</h2>
          <p className="muted db-sub">สัดส่วนแผนงานในช่วงที่เลือก</p>
          {statusTotal === 0 ? <p className="muted db-empty">ไม่มีข้อมูลในช่วงนี้</p> : <>
            <div className="db-stack" role="img" aria-label={statusParts.filter(s => s.v).map(s => `${s.label} ${s.v}`).join(", ")}>
              {statusParts.filter(s => s.v > 0).map(s => <span key={s.key} style={{ flexGrow: s.v, background: s.color }} title={`${s.label} ${s.v}`} />)}
            </div>
            <ul className="db-legend">
              {statusParts.map(s => (
                <li key={s.key}><i style={{ background: s.color }} /><span>{s.label}</span><b>{nf(s.v)}</b>
                  <small>{statusTotal ? Math.round((s.v / statusTotal) * 100) : 0}%</small></li>
              ))}
            </ul>
          </>}
        </section>

        <section className="panel">
          <h2>ประเภทงาน</h2>
          <p className="muted db-sub">เรียงจากมากไปน้อย</p>
          <RankBars items={d.types.filter(t => t.value > 0)} empty="ไม่มีข้อมูลในช่วงนี้" />
        </section>

        <section className="panel">
          <h2>การใช้รถ</h2>
          <p className="muted db-sub">จำนวนแผนงานที่ใช้รถแต่ละคัน (สูงสุด 8 อันดับ)</p>
          <RankBars items={d.vehicles} empty="ยังไม่มีแผนงานที่เลือกใช้รถในช่วงนี้" />
        </section>

        <section className="panel db-wide-panel db-outage">
          <h2>⚡ แผนดับไฟที่กำลังจะมาถึง</h2>
          <p className="muted db-sub">
            {outages.length === 0 ? "ยังไม่มีแผนดับไฟ"
              : `${outages.length} รายการ · ผู้ใช้ไฟได้รับผลกระทบรวม ${nf(outCustomers)} ราย${outUnnotified ? ` · ยังไม่แจ้งผู้ใช้ไฟ ${outUnnotified} รายการ` : ""}`}
          </p>
          {outages.length > 0 && (
            <ul className="db-upcoming">
              {outages.slice(0, 8).map(p => (
                <li key={p.id}>
                  <span className="db-when"><b>{fmtDate(p.outage!.outage_start)}</b><small>{fmtTime(p.outage!.outage_start)}–{fmtTime(p.outage!.outage_end)} น.</small></span>
                  <span className="db-what"><b>{p.outage!.area}</b><small>{p.title}{p.outage!.customers != null ? ` · ${nf(p.outage!.customers)} ราย` : ""}</small></span>
                  <span className="badge" style={p.outage!.notified ? { margin: 0, background: "#CFEFEA", color: "#0B4F49" } : { margin: 0, background: "#FCE6BC", color: "#6B4200" }}>
                    {p.outage!.notified ? "แจ้งแล้ว" : "ยังไม่แจ้ง"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {viewAll && !personId ? (
          <section className="panel db-wide-panel">
            <h2>ภาระงานรายบุคคล</h2>
            <p className="muted db-sub">จำนวนแผนงานที่แต่ละคนเป็นผู้ควบคุมงานหรือผู้ปฏิบัติงาน (10 อันดับแรก)</p>
            <RankBars items={d.ranking} empty="ไม่มีข้อมูลในช่วงนี้" />
          </section>
        ) : (
          <section className="panel db-wide-panel">
            <h2>งานที่กำลังจะมาถึง</h2>
            <p className="muted db-sub">5 รายการถัดไป{personId && personId !== profile.id ? ` ของ ${whoName}` : ""}</p>
            {next5.length === 0 ? <p className="muted db-empty">ยังไม่มีแผนงานที่กำลังจะมาถึง</p> : (
              <ul className="db-upcoming">
                {next5.map(p => (
                  <li key={p.id}>
                    <span className="db-when"><b>{fmtDate(p.start_at)}</b><small>{fmtTime(p.start_at)}–{fmtTime(p.end_at)} น.</small></span>
                    <span className="db-what"><b>{p.title}</b><small>📍 {p.location}</small></span>
                    <span className="badge" style={{ margin: 0, background: APPROVALS[p.approval_status].bg, color: APPROVALS[p.approval_status].fg }}>{APPROVALS[p.approval_status].label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, color, tone }: { label: string; value: number; hint?: string; color?: string; tone?: "brand" }) {
  return (
    <div className={`db-kpi${tone === "brand" ? " db-kpi-main" : ""}`}>
      {color && <i className="db-kpi-dot" style={{ background: color }} />}
      <span className="db-kpi-label">{label}</span>
      <b className="db-kpi-value">{nf(value)}</b>
      {hint && <small className="db-kpi-hint">{hint}</small>}
    </div>
  );
}

function RankBars({ items, empty }: { items: { label: string; value: number }[]; empty: string }) {
  if (items.length === 0) return <p className="muted db-empty">{empty}</p>;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <ul className="db-rank">
      {items.map(i => (
        <li key={i.label}>
          <span className="db-rank-label" title={i.label}>{i.label}</span>
          <span className="db-rank-track"><span style={{ width: `${Math.max((i.value / max) * 100, 2)}%` }} /></span>
          <b>{nf(i.value)}</b>
        </li>
      ))}
    </ul>
  );
}

function TrendChart({ data, unit }: { data: { label: string; full: string; value: number }[]; unit: string }) {
  const [hi, setHi] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const apply = () => setW(Math.max(280, Math.round(el.clientWidth)));
    apply();
    const ro = new ResizeObserver(apply); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 480 ? 200 : 230, ml = 28, mr = 6, mt = 12, mb = 26;
  const iw = W - ml - mr, ih = H - mt - mb;
  const max = Math.max(...data.map(x => x.value), 0);
  const top = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const step = iw / data.length;
  const bw = Math.min(22, step * 0.62);
  const showEvery = data.length > 16 ? (W < 480 ? 5 : 5) : 1;
  const y = (v: number) => mt + ih - (v / top) * ih;
  const total = data.reduce((s, x) => s + x.value, 0);
  const h = hi !== null ? data[hi] : null;
  return (
    <div className="db-trend" ref={box}>
      {total === 0 && <p className="db-trend-empty muted">ไม่มีแผนงานในช่วงนี้</p>}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`กราฟแท่ง ${data.length} ช่วง รวม ${total} แผนงาน`} onMouseLeave={() => setHi(null)}>
        {[0, 1, 2, 3, 4].map(i => {
          const v = (top / 4) * i;
          return <g key={i}>
            <line x1={ml} x2={W - mr} y1={y(v)} y2={y(v)} stroke="#E6E1EE" strokeWidth={i === 0 ? 1.5 : 1} />
            <text x={ml - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#7C7491">{v}</text>
          </g>;
        })}
        {data.map((x, i) => {
          const cx = ml + step * i + step / 2;
          const bh = (x.value / top) * ih;
          return <g key={i} onMouseEnter={() => setHi(i)} onTouchStart={() => setHi(i)}>
            <rect x={ml + step * i} y={mt} width={step} height={ih + mb} fill="transparent" />
            {x.value > 0 && <path d={`M${cx - bw / 2},${y(0)} v${-(Math.max(bh - 4, 0))} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${Math.max(bh - 4, 0)} z`}
              fill={hi === i ? "#4A2A8A" : "#6B3FA0"} />}
            {(i % showEvery === 0 || i === data.length - 1) && (data.length <= 16 || i % showEvery === 0) &&
              <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" fill="#7C7491">{x.label}</text>}
          </g>;
        })}
      </svg>
      {h && <div className="db-tip" style={{ left: `${((ml + step * (hi as number) + step / 2) / W) * 100}%` }}>
        <b>{unit ? `${unit} ` : ""}{h.full}</b><span>{h.value} แผนงาน</span></div>}
    </div>
  );
}
