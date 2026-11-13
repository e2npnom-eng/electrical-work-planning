"use client";

import type { WorkPlan } from "@/types/plan";
import type { EmployeeProfile } from "@/types/employee";

export function PlanDetail({ plan, canEdit, canDelete, onClose, onEdit, onDelete }: {
  plan: WorkPlan; profile: EmployeeProfile; canEdit: boolean; canDelete: boolean;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const dateFormat = (value: string) => new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  const statusLabels: Record<string, string> = { planned: "วางแผนแล้ว", in_progress: "กำลังดำเนินการ", completed: "เสร็จสิ้น", cancelled: "ยกเลิก" };
  const typeLabels: Record<string, string> = { maintenance: "บำรุงรักษา", fault: "แก้ไขเหตุขัดข้อง", construction: "ก่อสร้าง / ติดตั้ง", inspection: "ตรวจสอบ", other: "อื่น ๆ" };
  const members = (plan.work_plan_members ?? []).map(m => m.employee?.full_name).filter(Boolean) as string[];

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={plan.title}>
      <section className="modal">
        <div className="modal-head">
          <div>
            <span className={`badge s-${plan.status}`}>{statusLabels[plan.status] ?? plan.status}</span>
            <h2>{plan.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <dl className="facts">
          <div><dt>ผู้ควบคุมงาน</dt><dd>{plan.controller?.full_name ?? "-"}</dd></div>
          <div><dt>ผู้สร้าง</dt><dd>{plan.creator?.full_name ?? "-"}</dd></div>
          <div><dt>สถานที่</dt><dd>{plan.location}</dd></div>
          <div><dt>ประเภทงาน</dt><dd>{plan.work_type ? (typeLabels[plan.work_type] ?? plan.work_type) : "-"}</dd></div>
          <div><dt>เริ่ม</dt><dd>{dateFormat(plan.start_at)}</dd></div>
          <div><dt>สิ้นสุด</dt><dd>{dateFormat(plan.end_at)}</dd></div>
        </dl>
        <div style={{ marginBottom: 24 }}>
          <div className="muted" style={{ marginBottom: 10 }}>ทีมงาน</div>
          {members.length ? <div className="chips">
            {members.map((name, i) => <span className="person" key={i}><b>{name.charAt(0)}</b>{name}</span>)}
          </div> : <span>-</span>}
        </div>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>รายละเอียด</div>
          <p style={{ margin: 0, lineHeight: 1.7, maxWidth: "62ch" }}>{plan.description || "-"}</p>
        </div>
        {(canEdit || canDelete) && <div className="modal-actions">
          {canEdit && <button className="btn" onClick={onEdit}>แก้ไขแผนงาน</button>}
          {canDelete && <button className="btn danger" onClick={onDelete}>ลบแผนงาน</button>}
        </div>}
      </section>
    </div>
  );
}
