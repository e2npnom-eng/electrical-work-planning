"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { approvalOf, fmtDateTime, statusLabel, typeIcon, typeLabel } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan } from "@/types/plan";

type Log = {
  id: number; action: string; actor_name: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null; created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  create: "สร้างแผนงาน", update: "แก้ไขข้อมูล", submit: "ส่งขออนุมัติ", approve: "อนุมัติ",
  return: "ส่งกลับแก้ไข", withdraw: "ถอนกลับเป็นร่าง", resubmit: "แก้ไขและส่งอนุมัติใหม่", delete: "ลบแผนงาน"
};
const FIELD_LABELS: Record<string, string> = {
  title: "ชื่อแผนงาน", location: "สถานที่", start_at: "วันเริ่ม", end_at: "วันสิ้นสุด",
  controller_id: "ผู้ควบคุมงาน", work_type: "ประเภทงาน", status: "สถานะงาน",
  description: "รายละเอียด", review_note: "หมายเหตุผู้อนุมัติ", recurrence_group: "ชุดงานซ้ำ"
};

type Props = {
  plan: WorkPlan; profile: EmployeeProfile; canEdit: boolean; canDelete: boolean;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
  onCopy?: () => void; onCopyLink?: () => void;
  onSubmit?: () => void; onApprove?: () => void; onReturn?: (note: string) => void;
  busy?: boolean; actionError?: string;
};

export function PlanDetail({
  plan, profile, canEdit, canDelete, onClose, onEdit, onDelete,
  onCopy, onCopyLink, onSubmit, onApprove, onReturn, busy, actionError
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const ap = approvalOf(plan);
  const isAdmin = profile.role === "admin";
  const members = (plan.work_plan_members ?? []).map(m => m.employee?.full_name).filter(Boolean) as string[];
  const canSubmit = onSubmit && (plan.created_by === profile.id || isAdmin) &&
    (plan.approval_status === "draft" || plan.approval_status === "returned");

  async function toggleLogs() {
    const next = !showLogs;
    setShowLogs(next);
    if (next && logs === null) {
      const { data } = await supabase.from("audit_logs")
        .select("id, action, actor_name, changes, created_at").eq("plan_id", plan.id)
        .order("created_at", { ascending: false }).limit(30);
      setLogs((data ?? []) as Log[]);
    }
  }

  function describe(l: Log) {
    if (!l.changes) return "";
    if (l.action === "return" && l.changes.review_note) return `เหตุผล: ${String(l.changes.review_note.to ?? "")}`;
    const names = Object.keys(l.changes).map(k => FIELD_LABELS[k]).filter(Boolean);
    return names.length ? `แก้: ${names.join(", ")}` : "";
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={plan.title}>
      <section className="modal">
        <div className="modal-head">
          <div>
            <span className="badge" style={{ background: ap.bg, color: ap.fg }}>{ap.label}</span>{" "}
            <span className={`badge s-${plan.status}`}>{statusLabel(plan.status)}</span>
            <h2>{typeIcon(plan.work_type)} {plan.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {plan.approval_status === "returned" && (
          <p className="warn-box"><b>ถูกส่งกลับแก้ไข:</b> {plan.review_note || "ไม่ได้ระบุเหตุผล"}</p>
        )}
        {plan.approval_status === "approved" && plan.approved_at && (
          <p className="ok-box">อนุมัติโดย {plan.approver?.full_name ?? "-"} เมื่อ {fmtDateTime(plan.approved_at)}</p>
        )}

        <dl className="facts">
          <div><dt>ผู้ควบคุมงาน</dt><dd>{plan.controller?.full_name ?? "-"}</dd></div>
          <div><dt>วางแผนโดย</dt><dd>{plan.creator?.full_name ?? "-"}{plan.created_at ? <small className="muted"> เมื่อ {fmtDateTime(plan.created_at)}</small> : null}</dd></div>
          <div><dt>สถานที่</dt><dd>{plan.location}</dd></div>
          <div><dt>ประเภทงาน</dt><dd>{typeLabel(plan.work_type)}</dd></div>
          <div><dt>เริ่ม</dt><dd>{fmtDateTime(plan.start_at)}</dd></div>
          <div><dt>สิ้นสุด</dt><dd>{fmtDateTime(plan.end_at)}</dd></div>
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

        <div className="history">
          <button type="button" className="link-btn" onClick={() => void toggleLogs()}>
            {showLogs ? "ซ่อนประวัติการแก้ไข" : "ดูประวัติการแก้ไข"}
          </button>
          {showLogs && (logs === null ? <p className="muted">กำลังโหลด...</p> : logs.length === 0
            ? <p className="muted">ยังไม่มีประวัติ</p>
            : <ul className="log-list">
                {logs.map(l => (
                  <li key={l.id}>
                    <b>{ACTION_LABELS[l.action] ?? l.action}</b> · {l.actor_name ?? "-"}
                    <small>{fmtDateTime(l.created_at)}</small>
                    {describe(l) && <div className="muted">{describe(l)}</div>}
                  </li>
                ))}
              </ul>)}
        </div>

        {returning && (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="pd-note">เหตุผลที่ส่งกลับ (ผู้สร้างจะเห็นข้อความนี้)</label>
            <textarea id="pd-note" value={note} onChange={e => setNote(e.target.value)} placeholder="เช่น ปรับวันเวลาให้ไม่ชนกับงานอื่น" />
            <div className="chips">
              <button className="btn danger" disabled={busy || !note.trim()}
                onClick={() => { onReturn?.(note.trim()); setReturning(false); setNote(""); }}>ยืนยันส่งกลับ</button>
              <button className="btn secondary" onClick={() => setReturning(false)}>ยกเลิก</button>
            </div>
          </div>
        )}
        {actionError && <p className="error" role="alert">{actionError}</p>}

        <div className="modal-actions">
          {onCopyLink && <button className="btn secondary" onClick={onCopyLink}>คัดลอกลิงก์</button>}
          {onCopy && <button className="btn secondary" onClick={onCopy}>คัดลอกแผน</button>}
          {canEdit && <button className="btn secondary" onClick={onEdit}>แก้ไข</button>}
          {canSubmit && <button className="btn" disabled={busy} onClick={onSubmit}>ส่งขออนุมัติ</button>}
          {isAdmin && onApprove && plan.approval_status !== "approved" && (
            <button className="btn" disabled={busy} onClick={onApprove}>อนุมัติ</button>
          )}
          {isAdmin && onReturn && plan.approval_status === "pending" && !returning && (
            <button className="btn danger" disabled={busy} onClick={() => setReturning(true)}>ส่งกลับแก้ไข</button>
          )}
          {canDelete && <button className="btn danger" onClick={onDelete}>ลบ</button>}
        </div>
      </section>
    </div>
  );
}
