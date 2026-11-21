"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type { DateClickArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import thLocale from "@fullcalendar/core/locales/th";
import type { DatesSetArg, EventClickArg, EventInput } from "@fullcalendar/core";
import { createClient } from "@/lib/supabase/client";
import { PlanForm } from "@/components/plans/PlanForm";
import type { Prefill } from "@/components/plans/PlanForm";
import { PlanDetail } from "@/components/plans/PlanDetail";
import {
  APPROVALS, PLAN_SELECT, WORK_TYPES, approvalOf, byEmployeeCode, canDeletePlan, canEditPlan,
  canViewAll, expiryLabel, expiryOf, fmtDate, fmtTime, isMine, typeIcon
} from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { ApprovalStatus, Vehicle, WorkPlan } from "@/types/plan";

type Range = { start: string; end: string };
type Props = { profile: EmployeeProfile; initialPlanId?: string };

const DAY = 86400000;
const PAST = { bg: "#E4E0EC", fg: "#5F5875" }; // งานที่ผ่านไปแล้ว
const CANCELLED = { bg: "#F1EFF5", fg: "#8B849C" }; // งานที่ยกเลิกแล้ว
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const overlaps = (p: WorkPlan, from: Date, to: Date) =>
  new Date(p.start_at).getTime() < to.getTime() && new Date(p.end_at).getTime() > from.getTime();

function PlanItem({ plan, showWho, onOpen, no }: { plan: WorkPlan; showWho: boolean; onOpen: (p: WorkPlan) => void; no?: number }) {
  const ap = approvalOf(plan);
  const asking = Boolean(plan.cancel_requested_at) && plan.status !== "cancelled";
  const sameDay = dayStart(new Date(plan.start_at)).getTime() === dayStart(new Date(plan.end_at)).getTime();
  return (
    <button className="today-item" onClick={() => onOpen(plan)}>
      {no !== undefined && <span className="today-no" aria-label={`ลำดับที่ ${no}`}>{no}</span>}
      <span className="today-time">{sameDay ? `${fmtTime(plan.start_at)}–${fmtTime(plan.end_at)}` : "ต่อเนื่อง"}</span>
      <span className="today-main">
        <b className={plan.status === "cancelled" ? "ev-cancelled" : undefined}>{typeIcon(plan.work_type)} {plan.title}</b>
        <small>📍 {plan.location}</small>
        {(showWho || no !== undefined) && plan.controller && <small>👤 {plan.controller.full_name}{(plan.work_plan_members?.length ?? 0) > 0 ? ` +${plan.work_plan_members!.length} คน` : ""}</small>}
        {(plan.work_plan_vehicles?.length ?? 0) > 0 && <small>🚗 {plan.work_plan_vehicles!.map(v => v.vehicle?.code).filter(Boolean).join(", ")}</small>}
      </span>
      <span className="badges">
        {expiryOf(plan) && <span className={`mini-badge expiry-badge expiry-${expiryOf(plan)}`}>{expiryLabel(expiryOf(plan)!)}</span>}
      <span className="mini-badge" style={asking ? { background: "#F8D7D2", color: "#7A1D12" } : { background: ap.bg, color: ap.fg }}>{asking ? "ขอยกเลิก" : ap.label}</span>
      </span>
    </button>
  );
}

export function CalendarPage({ profile, initialPlanId }: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const calRef = useRef<FullCalendar>(null);
  const rangeRef = useRef<Range | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const viewAll = canViewAll(profile.role);
  const isAdmin = profile.role === "admin";

  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [window2, setWindow2] = useState<WorkPlan[]>([]);
  const [attention, setAttention] = useState<WorkPlan[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [range, setRange] = useState<Range | null>(null);
  const [span, setSpan] = useState<Range | null>(null); // ช่วงที่แสดงจริง (เดือน/สัปดาห์)
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<{ plan: WorkPlan | null; prefill?: Prefill } | null>(null);
  const [selected, setSelected] = useState<WorkPlan | null>(null);
  const [scope, setScope] = useState<"mine" | "all">(viewAll ? "all" : "mine");
  const ord = (p: WorkPlan) => p.created_at ?? "";
  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fApproval, setFApproval] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [isMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 700px)").matches);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  }, []);

  const loadRange = useCallback(async () => {
    const r = rangeRef.current;
    if (!r) return;
    const res = await supabase.from("work_plans").select(PLAN_SELECT)
      .lt("start_at", r.end).gt("end_at", r.start).order("start_at");
    if (res.error) setError(res.error.message);
    else { setError(""); setPlans((res.data ?? []) as unknown as WorkPlan[]); }
  }, [supabase]);

  const loadSide = useCallback(async () => {
    const s = dayStart(new Date());
    const e = new Date(s.getTime() + 2 * DAY);
    const [a, b] = await Promise.all([
      supabase.from("work_plans").select(PLAN_SELECT).lt("start_at", e.toISOString()).gt("end_at", s.toISOString())
        .neq("status", "cancelled").order("start_at"),
      supabase.from("work_plans").select(PLAN_SELECT)
        .or("approval_status.in.(pending,returned),cancel_requested_at.not.is.null")
        .neq("status", "cancelled").order("start_at").limit(50)
    ]);
    if (!a.error) setWindow2((a.data ?? []) as unknown as WorkPlan[]);
    if (!b.error) setAttention((b.data ?? []) as unknown as WorkPlan[]);
  }, [supabase]);

  const refreshSelected = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id) return;
    const { data } = await supabase.from("work_plans").select(PLAN_SELECT).eq("id", id).maybeSingle();
    if (data) setSelected(data as unknown as WorkPlan);
  }, [supabase]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadRange(), loadSide(), refreshSelected()]);
  }, [loadRange, loadSide, refreshSelected]);

  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);

  useEffect(() => {
    void loadSide();
    void supabase.from("vehicles").select("id, code, plate, sort_order, active").eq("active", true).order("sort_order")
      .then(({ data }) => { if (data) setVehicles(data as Vehicle[]); });
    void supabase.from("employees").select("id, employee_code, full_name, role, active")
      .eq("active", true).order("full_name")
      .then(({ data }) => { if (data) setEmployees(byEmployeeCode(data as EmployeeProfile[])); });
  }, [supabase, loadSide]);

  useEffect(() => {
    rangeRef.current = range;
    if (!range) return;
    setLoading(true);
    void loadRange().finally(() => setLoading(false));
  }, [range, loadRange]);

  useEffect(() => {
    const trigger = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void reloadAll(), 400);
    };
    const channel = supabase.channel("calendar-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_plans" }, trigger)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_plan_members" }, trigger)
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [supabase, reloadAll]);

  // ลิงก์ตรงเข้าแผนงาน /calendar?plan=...
  useEffect(() => {
    if (!initialPlanId) return;
    void (async () => {
      const { data } = await supabase.from("work_plans").select(PLAN_SELECT).eq("id", initialPlanId).maybeSingle();
      if (!data) { setError("ไม่พบแผนงานตามลิงก์ หรือคุณไม่มีสิทธิ์ดูแผนงานนี้"); return; }
      const p = data as unknown as WorkPlan;
      setSelected(p);
      calRef.current?.getApi().gotoDate(p.start_at);
    })();
  }, [initialPlanId, supabase]);

  const onDatesSet = useCallback((arg: DatesSetArg) => {
    const next = { start: arg.start.toISOString(), end: arg.end.toISOString() };
    setSpan({ start: arg.view.currentStart.toISOString(), end: arg.view.currentEnd.toISOString() });
    setRange(cur => cur && cur.start === next.start && cur.end === next.end ? cur : next);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return plans.filter(p => {
      if (fType && p.work_type !== fType) return false;
      if (fApproval && p.approval_status !== fApproval) return false;
      if (onlyMine && !isMine(p, profile.id)) return false;
      if (needle) {
        const hay = [p.title, p.location, p.controller?.full_name,
          ...(p.work_plan_members ?? []).map(m => m.employee?.full_name)].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [plans, q, fType, fApproval, onlyMine, profile.id]);

  // ลำดับการวางแผน: ถ้าแผนซ้อนเวลากัน ให้แสดงว่าใครวางก่อน/หลัง
  const events = useMemo<EventInput[]>(() => filtered.map(p => {
    const c = approvalOf(p);
    const t0 = new Date(p.start_at).getTime(), t1 = new Date(p.end_at).getTime();
    // ซ้ำจริงเมื่อเวลาทับกัน และ (มีคนเดียวกัน หรือสถานที่เดียวกัน) — คนละทีมคนละที่ ไม่ถือว่าซ้ำ
    const people = (x: WorkPlan) => [x.controller_id, ...(x.work_plan_members ?? []).map(m => m.employee_id)];
    const mine = people(p);
    const place = p.location.trim().toLowerCase();
    const clash = plans.filter(o => o.id !== p.id && o.status !== "cancelled"
      && new Date(o.start_at).getTime() < t1 && new Date(o.end_at).getTime() > t0
      && (o.location.trim().toLowerCase() === place || people(o).some(id => mine.includes(id))));
    const rank = clash.length ? 1 + clash.filter(o => ord(o) < ord(p) || (ord(o) === ord(p) && o.id < p.id)).length : 0;
    const past = t1 < dayStart(new Date()).getTime(); // ผ่านวันนั้นไปแล้ว
    const cancelled = p.status === "cancelled";
    const asking = Boolean(p.cancel_requested_at) && !cancelled;
    const who = p.creator?.full_name ? `วางโดย ${p.creator.full_name}` : "";
    return {
      id: p.id, title: `${rank ? `#${rank} ` : ""}${asking ? "⚠ " : ""}${expiryOf(p) ? (expiryOf(p) === "over" ? "❗ " : "⏰ ") : ""}${typeIcon(p.work_type)} ${p.title}`, display: "block",
      start: p.start_at, end: p.end_at,
      backgroundColor: cancelled ? CANCELLED.bg : past ? PAST.bg : c.solid, textColor: cancelled ? CANCELLED.fg : past ? PAST.fg : c.onSolid, borderColor: c.solid,
      classNames: [...(p.status === "cancelled" ? ["ev-cancelled"] : []), ...(past ? ["ev-past"] : []), ...(expiryOf(p) ? [`ev-expiring-${expiryOf(p)}`] : [])],
      extendedProps: { plan: p, created: ord(p), who, past: past || cancelled }
    };
  }), [filtered, plans]);

  const today = dayStart(new Date());
  const tomorrow = new Date(today.getTime() + DAY);
  const dayAfter = new Date(today.getTime() + 2 * DAY);
  const scoped = (list: WorkPlan[]) => scope === "mine" ? list.filter(p => isMine(p, profile.id)) : list;
  const todayList = scoped(window2).filter(p => overlaps(p, today, tomorrow))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  // สถานะรถวันนี้ (ทุกคนเห็นรถทุกคัน ไม่ขึ้นกับตัวกรอง)
  const todayAll = window2.filter(p => p.status !== "cancelled" && overlaps(p, today, tomorrow))
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  const vehicleToday = vehicles.map(v => ({
    v, uses: todayAll.filter(p => (p.work_plan_vehicles ?? []).some(x => x.vehicle_id === v.id))
  }));
  const tomorrowList = scoped(window2).filter(p => overlaps(p, tomorrow, dayAfter));
  const todo = isAdmin
    ? attention.filter(p => p.approval_status === "pending" || p.cancel_requested_at || expiryOf(p) === "over")
    : attention.filter(p => p.created_by === profile.id);

  function closeDetail() {
    setSelected(null);
    setActionError("");
    if (initialPlanId) router.replace("/calendar");
  }

  function openNew(prefill?: Prefill) { setForm({ plan: null, prefill }); }

  function onDateClick(arg: DateClickArg) {
    const d = arg.date;
    const start = arg.allDay ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 30) : d;
    const end = arg.allDay ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 16, 30) : new Date(d.getTime() + 3600000);
    openNew({ start_at: start.toISOString(), end_at: end.toISOString() });
  }

  function onEventClick(info: EventClickArg) {
    setActionError("");
    setSelected(info.event.extendedProps.plan as WorkPlan);
  }

  function copyPlan(plan: WorkPlan) {
    const shift = (v: string) => new Date(new Date(v).getTime() + 7 * DAY).toISOString();
    setSelected(null);
    openNew({
      title: plan.title, controller_id: plan.controller_id, location: plan.location,
      start_at: shift(plan.start_at), end_at: shift(plan.end_at), work_type: plan.work_type ?? undefined,
      description: plan.description ?? "", memberIds: (plan.work_plan_members ?? []).map(m => m.employee_id),
      vehicleIds: (plan.work_plan_vehicles ?? []).map(v => v.vehicle_id), copied: true
    });
  }

  async function copyLink(plan: WorkPlan) {
    const url = `${window.location.origin}/calendar?plan=${plan.id}`;
    try { await navigator.clipboard.writeText(url); showToast("คัดลอกลิงก์แล้ว"); }
    catch { window.prompt("คัดลอกลิงก์นี้", url); }
  }

  async function setApproval(plan: WorkPlan, approval_status: ApprovalStatus, note?: string) {
    setBusy(true); setActionError("");
    const patch = { approval_status, ...(note !== undefined ? { review_note: note } : {}) };
    const { error: e } = await supabase.from("work_plans").update(patch).eq("id", plan.id);
    setBusy(false);
    if (e) { setActionError(e.message); return; }
    showToast(approval_status === "approved" ? "อนุมัติแล้ว" : approval_status === "returned" ? "ส่งกลับแล้ว" : "ส่งขออนุมัติแล้ว");
    await reloadAll();
  }

  async function patchPlan(plan: WorkPlan, patch: Record<string, unknown>, doneMessage: string) {
    setBusy(true); setActionError("");
    const { error: e } = await supabase.from("work_plans").update(patch).eq("id", plan.id);
    setBusy(false);
    if (e) { setActionError(e.message); return; }
    showToast(doneMessage);
    await reloadAll();
  }
  const clearRequest = { cancel_requested_at: null, cancel_requested_by: null, cancel_reason: null };

  async function deletePlan(plan: WorkPlan) {
    if (!window.confirm(`ลบแผนงาน "${plan.title}" ใช่หรือไม่?`)) return;
    const { error: e } = await supabase.from("work_plans").delete().eq("id", plan.id);
    if (e) setActionError(e.message);
    else { closeDetail(); await reloadAll(); }
  }

  const dateLabel = today.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long" });
  const nowMs = Date.now();
  const inSpan = span
    ? plans.filter(p => p.status !== "cancelled" && p.start_at >= span.start && p.start_at < span.end)
    : [];
  // สรุปสถานะงานของฉัน (ช่วงที่แสดง)
  const mineSpan = span
    ? plans.filter(p => isMine(p, profile.id) && p.start_at >= span.start && p.start_at < span.end)
    : [];
  const myDone = mineSpan.filter(p => p.status !== "cancelled" && p.approval_status === "approved" && new Date(p.end_at).getTime() < nowMs).length;
  const myCancelled = mineSpan.filter(p => p.status === "cancelled").length;
  const myEdit = mineSpan.filter(p => p.status !== "cancelled" && p.approval_status === "returned").length;
  const ongoingCount = window2.filter(p => p.status !== "cancelled"
    && new Date(p.start_at).getTime() <= nowMs && new Date(p.end_at).getTime() >= nowMs).length;
  const freeVehicles = vehicleToday.filter(x => x.uses.length === 0).length;

  const hasFilter = Boolean(q || fType || fApproval || onlyMine);

  return (
    <div className="home-wide">
      <div className="page-head">
        <div>
          <h1>ปฏิทินแผนงาน</h1>
          <p className="head-notes muted">เห็นแผนงานของทุกคน, แผนที่ซ้ำสถานที่หรือซ้ำคนจะมีเลขลำดับ #1 (วางก่อน) #2 ..., กดวันที่เพื่อสร้างแผนได้ทันที</p>
        </div>
        <div className="head-actions">
          <div className="filters head-filters">
            <select aria-label="ประเภทงาน" value={fType} onChange={e => setFType(e.target.value)}>
              <option value="">ทุกประเภทงาน</option>
              {WORK_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <select aria-label="สถานะอนุมัติ" value={fApproval} onChange={e => setFApproval(e.target.value)}>
              <option value="">ทุกสถานะอนุมัติ</option>
              {(Object.keys(APPROVALS) as ApprovalStatus[]).map(k => <option key={k} value={k}>{APPROVALS[k].label}</option>)}
            </select>
            {(
              <label className="check-inline"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />เฉพาะงานของฉัน</label>
            )}
            {hasFilter && <button className="link-btn" onClick={() => { setQ(""); setFType(""); setFApproval(""); setOnlyMine(false); }}>ล้างตัวกรอง</button>}
          </div>
          <label className="head-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" placeholder="ค้นหาแผนงาน / สถานที่ / ชื่อคน" aria-label="ค้นหา" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <button className="btn" onClick={() => openNew()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            เพิ่มแผนงาน
          </button>
        </div>
      </div>

      <div className="grid-cards">
        <div className="stat"><div><span className="muted">แผนงานในช่วงที่แสดง</span><strong>{inSpan.length} <small className="muted">แผนงาน</small></strong></div><i className="stat-ico" style={{ background: "#EDE6FA" }} aria-hidden="true">📅</i></div>
        <div className="stat"><div><span className="muted">กำลังดำเนินการ</span><strong>{ongoingCount} <small className="muted">แผนงาน</small></strong></div><i className="stat-ico" style={{ background: "#FFF0D6" }} aria-hidden="true">⚡</i></div>
        <div className={`stat stat-approval${todo.length ? " has-todo" : ""}`}>
          <div className="stat-body">
            <span className="muted">{isAdmin ? "รออนุมัติ / ขอยกเลิก" : "สถานะการอนุมัติของฉัน"}</span>
            {todo.slice(0, 3).map(p => {
              const kind = p.cancel_requested_at ? "cancel" : expiryOf(p) === "over" ? "over" : p.approval_status === "returned" ? "returned" : "pending";
              return (
                <button key={p.id} className={`ap-item ap-${kind}`} onClick={() => setSelected(p)}>
                  <span>{kind === "over" ? `${fmtDate(p.start_at)} ` : ""}{fmtTime(p.start_at)}</span> {p.title}{kind === "over" ? " · ผ่านวันแล้ว รอยกเลิก" : ""}
                </button>
              );
            })}
            {todo.length > 3 && <small className="muted">และอีก {todo.length - 3} รายการ</small>}
            {todo.length === 0 && <small className="muted">{isAdmin ? "ไม่มีแผนที่รออนุมัติ" : "ไม่มีรายการค้าง"}</small>}
          </div>
          <span className="bell" aria-label={`${todo.length} รายการ`}>
            <i className="stat-ico" style={{ background: "#FDE8E2" }} aria-hidden="true">🔔</i>
            {todo.length > 0 && <b className="bell-count">{todo.length}</b>}
          </span>
        </div>
      </div>

      {error && <p className="error" role="alert">{error}</p>}

      <div className="home-grid">
      <section className="panel cal-panel">
        <div className="muted cal-meta">{loading ? "กำลังโหลด..." : `${filtered.length} รายการในช่วงที่แสดง`}</div>
        <div className="fc-wrap">
          <FullCalendar ref={calRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={isMobile ? "listMonth" : "dayGridMonth"}
            headerToolbar={{ left: "prev,next today", center: "title", right: isMobile ? "dayGridMonth,listMonth" : "dayGridMonth,timeGridWeek,listMonth" }}
            buttonText={{ today: "วันนี้", month: "เดือน", week: "สัปดาห์", day: "วัน", list: "รายการ" }}
            locale={thLocale} height="auto" events={events} eventClick={onEventClick} dateClick={onDateClick}
            eventDidMount={arg => { if (arg.event.extendedProps.past) arg.el.style.boxShadow = `inset 4px 0 0 ${arg.event.borderColor}`; arg.el.title = `${arg.event.title}\n${String(arg.event.extendedProps.who ?? "")}`; }} datesSet={onDatesSet} eventOrder={(x, y) => String((x as { extendedProps?: { created?: string } }).extendedProps?.created ?? "").localeCompare(String((y as { extendedProps?: { created?: string } }).extendedProps?.created ?? ""))} dayMaxEvents={3} nowIndicator editable={false} />
        </div>
        <div className="legend">
          {(Object.keys(APPROVALS) as ApprovalStatus[]).map(k => (
            <span key={k}><i style={{ background: APPROVALS[k].solid }} />{APPROVALS[k].label}</span>
          ))}
          <span><i style={{ background: PAST.bg, boxShadow: "inset 0 0 0 1px #b9b2cc" }} />ผ่านไปแล้ว / ยกเลิก</span>
          <span className="muted">· ⏰ = ยังไม่อนุมัติและใกล้หมดเวลา · ❗ = ผ่านวันแล้วแต่ยังไม่อนุมัติ (แอดมินต้องยกเลิก) · งานที่ยกเลิกจะขีดฆ่า · ⚠ = มีคำขอยกเลิก · ไอคอนหน้าชื่อบอกประเภทงาน</span>
        </div>
      </section>
      <aside className="home-side">
        <section className="panel side-panel">
          <div className="today-head">
            <h2>วันนี้</h2>
            {(
              <div className="seg" role="group" aria-label="ขอบเขต">
                <button aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>ของฉัน</button>
                <button aria-pressed={scope === "all"} onClick={() => setScope("all")}>ทุกคน</button>
              </div>
            )}
          </div>
          {todayList.length === 0 ? <p className="muted">ไม่มีงานวันนี้</p>
            : todayList.map((p, i) => <PlanItem key={p.id} plan={p} no={i + 1} showWho={scope === "all"} onOpen={setSelected} />)}
        </section>
        {vehicles.length > 0 && (
          <section className="panel side-panel vehicle-panel" aria-label="สถานะรถวันนี้">
            <div className="today-head">
              <h2>รถวันนี้ <small>{dateLabel}</small></h2>
              <span className="count-pill veh-count">ว่าง {freeVehicles}/{vehicles.length}</span>
            </div>
            <div className="veh-list">
              {vehicleToday.map(({ v, uses }) => (
                <div key={v.id} className={`veh-row ${uses.length ? "veh-busy" : "veh-free"}`}>
                  <div className="veh-top">
                    <span><b>🚗 {v.code}</b>{v.plate && <small className="muted"> {v.plate}</small>}</span>
                    <span className="veh-state">{uses.length ? "ใช้งาน" : "ว่าง"}</span>
                  </div>
                  {uses.map(p => (
                    <button key={p.id} className="veh-use" onClick={() => setSelected(p)}>
                      <span>{fmtTime(p.start_at)}–{fmtTime(p.end_at)}</span> {p.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>
      </div>

      <div className="home-bottom">
        <section className="panel side-panel bottom-panel sum-panel">
          <div className="today-head"><h2>สรุปสถานะงานของฉัน</h2><span className="muted" style={{ fontSize: 13 }}>ในช่วงที่แสดงในปฏิทิน</span></div>
          <div className="sum-grid">
            <div className="sum-box sum-done"><strong>{myDone}</strong><span>เสร็จสิ้น</span></div>
            <div className="sum-box sum-cancel"><strong>{myCancelled}</strong><span>ยกเลิก</span></div>
            <div className="sum-box sum-edit"><strong>{myEdit}</strong><span>แก้ไข (ส่งกลับ)</span></div>
          </div>
        </section>
        <section className="panel side-panel bottom-panel">
          <div className="today-head"><h2>พรุ่งนี้</h2></div>
          {tomorrowList.length === 0 ? <p className="muted">ไม่มีงานพรุ่งนี้</p>
            : tomorrowList.map(p => <PlanItem key={p.id} plan={p} showWho={scope === "all"} onOpen={setSelected} />)}
        </section>
      </div>

      {form && <PlanForm profile={profile} employees={employees} vehicles={vehicles} plan={form.plan} prefill={form.prefill}
        onClose={() => setForm(null)}
        onSaved={async () => { setForm(null); setSelected(null); await reloadAll(); showToast("บันทึกแล้ว"); }} />}
      {selected && <PlanDetail plan={selected} profile={profile}
        canEdit={canEditPlan(profile, selected)} canDelete={canDeletePlan(profile, selected)}
        busy={busy} actionError={actionError}
        onClose={closeDetail}
        onEdit={() => { setForm({ plan: selected }); setSelected(null); }}
        onDelete={() => void deletePlan(selected)}
        onCopy={() => copyPlan(selected)} onCopyLink={() => void copyLink(selected)}
        onSubmit={() => void setApproval(selected, "pending")}
        onApprove={() => void setApproval(selected, "approved")}
        onReturn={note => void setApproval(selected, "returned", note)}
        onCancelRequest={reason => void patchPlan(selected, { cancel_requested_at: new Date().toISOString(), cancel_reason: reason }, "ส่งคำขอยกเลิกแล้ว")}
        onCancelWithdraw={() => void patchPlan(selected, clearRequest, "ถอนคำขอแล้ว")}
        onCancelApprove={() => void patchPlan(selected, { status: "cancelled" }, "ยกเลิกแผนงานแล้ว")}
        onCancelReject={() => void patchPlan(selected, clearRequest, "ปฏิเสธคำขอแล้ว")}
        onCancelNow={reason => void patchPlan(selected, { status: "cancelled", cancel_reason: reason || null }, "ยกเลิกแผนงานแล้ว")} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
