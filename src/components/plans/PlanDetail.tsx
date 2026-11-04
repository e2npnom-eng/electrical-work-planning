"use client";

import type { CSSProperties } from "react";
import type { WorkPlan } from "@/types/plan";
import type { EmployeeProfile } from "@/types/employee";

export function PlanDetail({ plan, profile, canEdit, canDelete, onClose, onEdit, onDelete }: {
  plan: WorkPlan; profile: EmployeeProfile; canEdit: boolean; canDelete: boolean;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const dateFormat = (value: string) => new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  const statusLabels: Record<string, string> = { planned: "วางแผนแล้ว", in_progress: "กำลังดำเนินการ", completed: "เสร็จสิ้น", cancelled: "ยกเลิก" };
  return <div style={overlay}>
    <section className="panel" style={modal}>
      <div className="toolbar"><h2 style={{ margin: 0 }}>{plan.title}</h2><button className="btn secondary" onClick={onClose}>ปิด</button></div>
      <p><b>ผู้ควบคุมงาน:</b> {plan.controller?.full_name ?? "-"}</p>
      <p><b>สถานที่:</b> {plan.location}</p>
      <p><b>เริ่ม:</b> {dateFormat(plan.start_at)}</p>
      <p><b>สิ้นสุด:</b> {dateFormat(plan.end_at)}</p>
      <p><b>ประเภทงาน:</b> {plan.work_type ?? "-"}</p>
      <p><b>สถานะ:</b> {statusLabels[plan.status] ?? plan.status}</p>
      <p><b>ผู้สร้าง:</b> {plan.creator?.full_name ?? "-"}</p>
      <p><b>ทีมงาน:</b> {plan.work_plan_members?.map(m => m.employee?.full_name).filter(Boolean).join(", ") || "-"}</p>
      <p><b>รายละเอียด:</b><br />{plan.description || "-"}</p>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
        {canEdit && <button className="btn" onClick={onEdit}>แก้ไขแผนงาน</button>}
        {canDelete && <button className="btn danger" onClick={onDelete}>ลบแผนงาน</button>}
      </div>
    </section>
  </div>;
}
const overlay: CSSProperties = { position: "fixed", inset: 0, zIndex: 50, background: "rgba(10,25,40,.55)", display: "grid", placeItems: "center", padding: 14 };
const modal: CSSProperties = { width: "100%", maxWidth: 600, maxHeight: "90vh", overflow: "auto" };
