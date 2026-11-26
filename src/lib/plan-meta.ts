import type { ApprovalStatus, WorkPlan, WorkStatus } from "@/types/plan";
import type { EmployeeProfile, Role } from "@/types/employee";

export const PLAN_SELECT =
  "*, controller:employees!work_plans_controller_id_fkey(id, full_name, employee_code), " +
  "creator:employees!work_plans_created_by_fkey(id, full_name, employee_code), " +
  "approver:employees!work_plans_approved_by_fkey(id, full_name, employee_code), " +
  "cancel_requester:employees!work_plans_cancel_requested_by_fkey(id, full_name, employee_code), " +
  "work_result:work_results(*, recorder:employees!work_results_recorded_by_fkey(id, full_name, employee_code)), " +
  "work_plan_members(employee_id, employee:employees(id, full_name, employee_code)), " +
  "work_plan_vehicles(vehicle_id, vehicle:vehicles(id, code, plate))";

export const WORK_TYPES: { value: string; label: string; icon: string }[] = [
  { value: "maintenance", label: "บำรุงรักษา", icon: "🔧" },
  { value: "fault", label: "แก้ไขเหตุขัดข้อง", icon: "⚡" },
  { value: "construction", label: "ก่อสร้าง / ติดตั้ง", icon: "🏗️" },
  { value: "inspection", label: "ตรวจสอบ", icon: "🔍" },
  { value: "other", label: "อื่น ๆ", icon: "📌" }
];

export const WORK_STATUSES: { value: WorkStatus; label: string }[] = [
  { value: "planned", label: "วางแผนแล้ว" },
  { value: "in_progress", label: "กำลังดำเนินการ" },
  { value: "completed", label: "เสร็จสิ้น" },
  { value: "cancelled", label: "ยกเลิก" }
];

export const APPROVALS: Record<ApprovalStatus, { label: string; bg: string; fg: string; dot: string; solid: string; onSolid: string }> = {
  draft: { label: "ร่าง", bg: "#E9E6EF", fg: "#4F4860", dot: "#7C7491", solid: "#7C7491", onSolid: "#FFFFFF" },
  pending: { label: "รออนุมัติ", bg: "#FCE6BC", fg: "#6B4200", dot: "#F5A623", solid: "#F5A623", onSolid: "#2A1450" },
  approved: { label: "อนุมัติแล้ว", bg: "#CFEFEA", fg: "#0B4F49", dot: "#0F766E", solid: "#0F766E", onSolid: "#FFFFFF" },
  returned: { label: "ส่งกลับแก้ไข", bg: "#F8D7D2", fg: "#7A1D12", dot: "#C0392B", solid: "#C0392B", onSolid: "#FFFFFF" }
};

export const ROLE_LABELS: Record<Role, string> = {
  admin: "ผู้ดูแลระบบ",
  executive: "ผู้บริหาร",
  employee: "พนักงาน"
};

export const typeLabel = (v: string | null) => WORK_TYPES.find(t => t.value === v)?.label ?? "-";
export const typeIcon = (v: string | null) => WORK_TYPES.find(t => t.value === v)?.icon ?? "📌";
export const statusLabel = (v: string) => WORK_STATUSES.find(s => s.value === v)?.label ?? v;
export const approvalOf = (p: Pick<WorkPlan, "approval_status">) => APPROVALS[p.approval_status] ?? APPROVALS.approved;

export const startOfToday = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); };
/** งานผ่านวันไปแล้ว = วันสิ้นสุดอยู่ก่อนวันนี้ */
export const RESULT_OUTCOMES = [
  { value: "completed", label: "เสร็จสมบูรณ์", icon: "✅" },
  { value: "partial", label: "เสร็จบางส่วน", icon: "🟡" },
  { value: "not_done", label: "ไม่ได้ดำเนินการ", icon: "⛔" }
] as const;

// อนุมัติแล้ว + ผ่านวันเริ่มงานแล้ว + ไม่ถูกยกเลิก + ยังไม่มีบันทึกผล
export const needsResult = (p: WorkPlan) =>
  p.approval_status === "approved" && p.status !== "cancelled" && !p.work_result &&
  new Date(p.start_at).getTime() < Date.now();

export const isPastPlan = (p: Pick<WorkPlan, "end_at">) => new Date(p.end_at).getTime() < startOfToday().getTime();

export const canViewAll = (role: Role) => role === "admin" || role === "executive";

export const isMine = (p: WorkPlan, id: string) =>
  p.controller_id === id || p.created_by === id || (p.work_plan_members ?? []).some(m => m.employee_id === id);

export const fmtDateTime = (v: string) =>
  new Date(v).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", hourCycle: "h23" });
export const fmtDate = (v: string) =>
  new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
export const fmtTime = (v: string) =>
  new Date(v).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

export function localDateTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export type Repeat = "none" | "weekly" | "biweekly" | "monthly";

export function shiftDate(d: Date, kind: Exclude<Repeat, "none">, i: number): Date {
  const r = new Date(d.getTime());
  if (kind === "monthly") {
    const day = r.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + i);
    const dim = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(day, dim));
  } else {
    r.setDate(r.getDate() + i * (kind === "weekly" ? 7 : 14));
  }
  return r;
}

export function canEditPlan(profile: EmployeeProfile, plan: WorkPlan) {
  return profile.role === "admin" || plan.created_by === profile.id;
}

export function canDeletePlan(profile: EmployeeProfile, plan: WorkPlan) {
  return profile.role === "admin" ||
    (plan.created_by === profile.id && (plan.approval_status === "draft" || plan.approval_status === "returned"));
}

export const vehicleLabel = (v: { code: string; plate: string }) => `${v.code} (${v.plate})`;

/** แผนที่ยังไม่อนุมัติ: ใกล้หมดเวลา (วันนี้/พรุ่งนี้) หรือผ่านวันไปแล้ว (แอดมินต้องยกเลิกเอง) */
export type Expiry = "over" | "today" | "soon";
export function expiryOf(p: Pick<WorkPlan, "end_at" | "status" | "approval_status">): Expiry | null {
  if (p.status === "cancelled" || p.approval_status === "approved") return null;
  const e = new Date(p.end_at);
  const endDay = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
  const days = Math.round((endDay - startOfToday().getTime()) / 86400000);
  return days < 0 ? "over" : days === 0 ? "today" : days === 1 ? "soon" : null;
}
export const expiryLabel = (k: Expiry) => (k === "over" ? "❗ ผ่านวันแล้ว" : k === "today" ? "⏰ หมดเวลาวันนี้" : "⏰ เหลือ 1 วัน");

export function byEmployeeCode<T extends { employee_code: string }>(list: T[]): T[] {
  // รหัสตัวเลข (พนักงาน) เรียงน้อยไปมากก่อน แล้วตามด้วยรหัสอื่น เช่น ทีมงาน (TEAM01…) ไว้ล่างสุด
  const isNum = (c: string) => /^\d+$/.test(c);
  return [...list].sort((a, b) => {
    const an = isNum(a.employee_code), bn = isNum(b.employee_code);
    if (an !== bn) return an ? -1 : 1;
    return a.employee_code.length - b.employee_code.length || a.employee_code.localeCompare(b.employee_code);
  });
}
