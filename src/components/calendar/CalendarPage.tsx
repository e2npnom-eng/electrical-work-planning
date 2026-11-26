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
import { CalendarHeader } from "./CalendarHeader";
import { PlanItem } from "./PlanItem";
import { StatCards } from "./StatCards";
import { SummaryPanel } from "./SummaryPanel";
import { VehiclePanel } from "./VehiclePanel";
import { usePlanActions } from "./usePlanActions";
import { DAY, dayStart, fromYmd, overlaps, ymd } from "./dates";
import {
  APPROVALS, PLAN_SELECT, approvalOf, byEmployeeCode, canDeletePlan, canEditPlan,
  canViewAll, expiryOf, isMine, typeIcon
} from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { ApprovalStatus, Vehicle, WorkPlan } from "@/types/plan";

type Range = { start: string; end: string };
type Props = { profile: EmployeeProfile; initialPlanId?: string };

const PAST = { bg: "#E4E0EC", fg: "#5F5875" }; // งานที่ผ่านไปแล้ว
const CANCELLED = { bg: "#F1EFF5", fg: "#8B849C" }; // งานที่ยกเลิกแล้ว

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
  const [vehDate, setVehDate] = useState(() => ymd(new Date()));
  const [vehPlans, setVehPlans] = useState<WorkPlan[]>([]);
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

  const loadVeh = useCallback(async () => {
    const s = fromYmd(vehDate);
    const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 1);
    const { data, error: err } = await supabase.from("work_plans").select(PLAN_SELECT)
      .lt("start_at", e.toISOString()).gt("end_at", s.toISOString()).neq("status", "cancelled").order("start_at");
    if (!err) setVehPlans((data ?? []) as unknown as WorkPlan[]);
  }, [supabase, vehDate]);

  const refreshSelected = useCallback(async () => {
    const id = selectedIdRef.current;
    if (!id) return;
    const { data } = await supabase.from("work_plans").select(PLAN_SELECT).eq("id", id).maybeSingle();
    if (data) setSelected(data as unknown as WorkPlan);
  }, [supabase]);

  const reloadAll = useCallback(async () => {
    await Promise.all([loadRange(), loadSide(), loadVeh(), refreshSelected()]);
  }, [loadRange, loadSide, loadVeh, refreshSelected]);

  useEffect(() => { void loadVeh(); }, [loadVeh]);

  useEffect(() => { selectedIdRef.current = selected?.id ?? null; }, [selected]);

  useEffect(() => {
    void loadSide();
    void supabase.from("vehicles").select("id, code, plate, sort_order, active").eq("active", true).order("sort_order")
      .then(({ data }) => { if (data) setVehicles(data as Vehicle[]); });
    void supabase.from("employees").select("id, employee_code, full_name, role, active, position")
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
  const vehDay = fromYmd(vehDate);
  const vehDayEnd = new Date(vehDay.getFullYear(), vehDay.getMonth(), vehDay.getDate() + 1);
  const vehicleToday = vehicles.map(v => ({
    v, uses: vehPlans.filter(p => overlaps(p, vehDay, vehDayEnd)).filter(p => (p.work_plan_vehicles ?? []).some(x => x.vehicle_id === v.id))
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

  function newWithVehicle(v: Vehicle, date: string) {
    const d = fromYmd(date);
    openNew({
      start_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 30).toISOString(),
      end_at: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 16, 30).toISOString(),
      vehicleIds: [v.id]
    });
  }

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

  const { busy, actionError, setActionError, setApproval, patchPlan, deletePlan, clearRequest } =
    usePlanActions({ supabase, reloadAll, showToast, closeDetail });
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

  return (
    <div className="home-wide">
      <CalendarHeader q={q} setQ={setQ} fType={fType} setFType={setFType} fApproval={fApproval} setFApproval={setFApproval}
        onlyMine={onlyMine} setOnlyMine={setOnlyMine} onAdd={() => openNew()} />

      <StatCards inSpanCount={inSpan.length} ongoing={ongoingCount} todo={todo} isAdmin={isAdmin} onOpen={setSelected} />

      {error && <p className="error" role="alert">{error}</p>}

      <div className="home-grid">
      <section className="panel cal-panel">
        <div className="muted cal-meta">{loading ? "กำลังโหลด..." : `${filtered.length} รายการในช่วงที่แสดง`}</div>
        <div className="fc-wrap">
          <FullCalendar ref={calRef} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView={isMobile ? "listMonth" : "dayGridMonth"}
            headerToolbar={{ left: "prev,next today", center: "title", right: isMobile ? "dayGridMonth,listMonth" : "dayGridMonth,timeGridWeek,listMonth" }}
            buttonText={{ today: "วันนี้", month: "เดือน", week: "สัปดาห์", day: "วัน", list: "รายการ" }}
            locale={thLocale} height="auto" eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }} slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }} events={events} eventClick={onEventClick} dateClick={onDateClick}
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
        {vehicles.length > 0 && <VehiclePanel vehicles={vehicles} rows={vehicleToday} vehDate={vehDate} setVehDate={setVehDate}
          onPick={newWithVehicle} onOpenPlan={setSelected} />}
      </aside>
      </div>

      <div className="home-bottom">
        <SummaryPanel done={myDone} cancelled={myCancelled} edit={myEdit} />
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
        onClose={closeDetail} onResultSaved={() => void reloadAll()}
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
