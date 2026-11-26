import { approvalOf, expiryLabel, expiryOf, fmtTime, needsResult, typeIcon } from "@/lib/plan-meta";
import type { WorkPlan } from "@/types/plan";
import { dayStart } from "./dates";

export function PlanItem({ plan, showWho, onOpen, no }: { plan: WorkPlan; showWho: boolean; onOpen: (p: WorkPlan) => void; no?: number }) {
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
        {plan.outage && <span className="mini-badge" style={{ background: "#2A1450", color: "#FFD27A" }}>⚡ ดับไฟ</span>}
        {needsResult(plan) && <span className="mini-badge" style={{ background: "#FCEFC4", color: "#6B4200" }}>📝 รอบันทึกผล</span>}
        {expiryOf(plan) && <span className={`mini-badge expiry-badge expiry-${expiryOf(plan)}`}>{expiryLabel(expiryOf(plan)!)}</span>}
      <span className="mini-badge" style={asking ? { background: "#F8D7D2", color: "#7A1D12" } : { background: ap.bg, color: ap.fg }}>{asking ? "ขอยกเลิก" : ap.label}</span>
      </span>
    </button>
  );
}
