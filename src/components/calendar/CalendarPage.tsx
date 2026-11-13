"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import thLocale from "@fullcalendar/core/locales/th";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { createClient } from "@/lib/supabase/client";
import { PlanForm } from "@/components/plans/PlanForm";
import { PlanDetail } from "@/components/plans/PlanDetail";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan } from "@/types/plan";

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  planned: { bg: "#EDE4F7", fg: "#3F1C66" },
  in_progress: { bg: "#FCE6BC", fg: "#6B4200" },
  completed: { bg: "#CFEFEA", fg: "#0B4F49" },
  cancelled: { bg: "#E7E4EC", fg: "#4F4860" }
};

export function CalendarPage({ profile }: { profile: EmployeeProfile }) {
  const supabase = useMemo(() => createClient(), []);
  const [plans, setPlans] = useState<WorkPlan[]>([]);
  const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<WorkPlan | null>(null);
  const [editing, setEditing] = useState<WorkPlan | null>(null);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setError("");
    const [planResult, employeeResult] = await Promise.all([
      supabase.from("work_plans").select("*, controller:employees!work_plans_controller_id_fkey(id, full_name, employee_code), creator:employees!work_plans_created_by_fkey(id, full_name, employee_code), work_plan_members(employee_id, employee:employees(id, full_name, employee_code))").order("start_at"),
      supabase.from("employees").select("id, employee_code, full_name, role, active").eq("active", true).order("full_name")
    ]);
    if (planResult.error) setError(planResult.error.message);
    else setPlans((planResult.data ?? []) as unknown as WorkPlan[]);
    if (!employeeResult.error) setEmployees((employeeResult.data ?? []) as EmployeeProfile[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { void loadData(); }, [loadData]);

  useEffect(() => {
    const channel = supabase.channel("calendar-live-updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "work_plans" }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "work_plan_members" }, () => void loadData())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supabase, loadData]);

  const events: EventInput[] = plans.map(plan => {
    const c = STATUS_COLORS[plan.status] ?? STATUS_COLORS.planned;
    return {
      id: plan.id,
      title: plan.title,
      start: plan.start_at,
      end: plan.end_at,
      backgroundColor: c.bg,
      textColor: c.fg,
      borderColor: "transparent",
      extendedProps: { plan }
    };
  });

  function openEvent(info: EventClickArg) {
    const plan = info.event.extendedProps.plan as WorkPlan;
    setSelected(plan);
  }

  function openEdit(plan: WorkPlan) {
    setSelected(null);
    setEditing(plan);
    setFormOpen(true);
  }

  async function deletePlan(plan: WorkPlan) {
    if (!window.confirm(`ลบแผนงาน "${plan.title}" ใช่หรือไม่?`)) return;
    const { error: deleteError } = await supabase.from("work_plans").delete().eq("id", plan.id);
    if (deleteError) setError(deleteError.message);
    else { setSelected(null); await loadData(); }
  }

  const canEditSelected = selected && (profile.role === "admin" || selected.created_by === profile.id);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>ปฏิทินแผนงาน</h1>
          <p className="muted" style={{ margin: 0 }}>แผนงานที่บันทึกแล้วแสดงให้ทุกคนเห็นทันที</p>
        </div>
        <button className="btn" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          เพิ่มแผนงาน
        </button>
      </div>
      <div className="grid-cards">
        <div className="stat">
          <div><span className="muted">แผนงานทั้งหมด</span><strong>{plans.length}</strong></div>
          <span className="stat-bar" style={{ background: "#5B2A86" }} />
        </div>
        <div className="stat">
          <div><span className="muted">กำลังดำเนินการ / วางแผน</span><strong>{plans.filter(p => p.status === "planned" || p.status === "in_progress").length}</strong></div>
          <span className="stat-bar" style={{ background: "#F5A623" }} />
        </div>
        <div className="stat">
          <div><span className="muted">เสร็จสิ้น</span><strong>{plans.filter(p => p.status === "completed").length}</strong></div>
          <span className="stat-bar" style={{ background: "#0F766E" }} />
        </div>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <section className="panel">
        {loading ? <p>กำลังโหลดปฏิทิน...</p> : <div className="fc-wrap">
          <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
            initialView="dayGridMonth" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }}
            locale={thLocale} height="auto" events={events} eventClick={openEvent}
            dayMaxEvents={3} nowIndicator editable={false} />
        </div>}
        <div className="legend">
          <span><i style={{ background: "#5B2A86" }} />วางแผนแล้ว</span>
          <span><i style={{ background: "#F5A623" }} />กำลังดำเนินการ</span>
          <span><i style={{ background: "#0F766E" }} />เสร็จสิ้น</span>
          <span><i style={{ background: "#8A8299" }} />ยกเลิก</span>
        </div>
      </section>
      {formOpen && <PlanForm profile={profile} employees={employees} plan={editing}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={async () => { setFormOpen(false); setEditing(null); await loadData(); }} />}
      {selected && <PlanDetail plan={selected} profile={profile}
        canEdit={Boolean(canEditSelected)} canDelete={profile.role === "admin"}
        onClose={() => setSelected(null)} onEdit={() => openEdit(selected)}
        onDelete={() => void deletePlan(selected)} />}
    </div>
  );
}
