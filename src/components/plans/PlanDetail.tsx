"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { approvalOf, expiryLabel, expiryOf, fmtDateTime, isPastPlan, typeIcon, typeLabel } from "@/lib/plan-meta";
import type { EmployeeProfile } from "@/types/employee";
import type { WorkPlan } from "@/types/plan";

type Log = {
  id: number; action: string; actor_name: string | null;
  changes: Record<string, { from: unknown; to: unknown }> | null; created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  create: "สร้างแผนงาน", update: "แก้ไขข้อมูล", submit: "ส่งขออนุมัติ", approve: "อนุมัติ",
  return: "ส่งกลับแก้ไข", withdraw: "ถอนกลับเป็นร่าง", resubmit: "แก้ไขและส่งอนุมัติใหม่", delete: "ลบแผนงาน",
  cancel_request: "ขอยกเลิกแผนงาน", cancel_withdraw: "ถอนคำขอยกเลิก", cancel_reject: "ปฏิเสธคำขอยกเลิก", cancel: "ยกเลิกแผนงาน"
};
const FIELD_LABELS: Record<string, string> = {
  title: "ชื่อแผนงาน", location: "สถานที่", start_at: "วันเริ่ม", end_at: "วันสิ้นสุด",
  controller_id: "ผู้ควบคุมงาน", work_type: "ประเภทงาน", status: "สถานะงาน",
  description: "รายละเอียด", review_note: "หมายเหตุผู้อนุมัติ", recurrence_group: "ชุดงานซ้ำ", cancel_reason: "เหตุผลการยกเลิก"
};

type Props = {
  plan: WorkPlan; profile: EmployeeProfile; canEdit: boolean; canDelete: boolean;
  onClose: () => void; onEdit: () => void; onDelete: () => void;
  onCopy?: () => void; onCopyLink?: () => void;
  onSubmit?: () => void; onApprove?: () => void; onReturn?: (note: string) => void;
  onCancelRequest?: (reason: string) => void; onCancelWithdraw?: () => void;
  onCancelApprove?: () => void; onCancelReject?: () => void; onCancelNow?: (reason: string) => void;
  busy?: boolean; actionError?: string;
};

// แสดงข้อความตามที่พิมพ์ (ขึ้นบรรทัดใหม่ตามที่กด Enter) และทำลิงก์ http/https ให้กดได้
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return <>{parts.map((part, i) => {
    if (i % 2 === 0) return <span key={i}>{part}</span>;
    const m = part.match(/^(.*?)([).,;:!?\]]*)$/);
    const url = m ? m[1] : part;
    const tail = m ? m[2] : "";
    return <span key={i}><a href={url} target="_blank" rel="noopener noreferrer" className="auto-link">{url}</a>{tail}</span>;
  })}</>;
}

export function PlanDetail({
  plan, profile, canEdit, canDelete, onClose, onEdit, onDelete,
  onCopy, onCopyLink, onSubmit, onApprove, onReturn, busy, actionError,
  onCancelRequest, onCancelWithdraw, onCancelApprove, onCancelReject, onCancelNow
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [returning, setReturning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [note, setNote] = useState("");
  const [logs, setLogs] = useState<Log[] | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const ap = approvalOf(plan);
  const isAdmin = profile.role === "admin";
  const vehicles = (plan.work_plan_vehicles ?? []).map(v => v.vehicle).filter(Boolean) as { code: string; plate: string }[];
  const members = (plan.work_plan_members ?? []).map(m => m.employee?.full_name).filter(Boolean) as string[];
  const cancelled = plan.status === "cancelled";
  const past = isPastPlan(plan);
  const hasRequest = Boolean(plan.cancel_requested_at) && !cancelled;
  const isOwner = plan.created_by === profile.id;
  // ขอยกเลิกได้: ผู้สร้าง, ยังไม่ผ่านวัน, ไม่ใช่ร่าง, ยังไม่ถูกยกเลิก/ไม่มีคำขอค้าง
  const canRequestCancel = Boolean(onCancelRequest) && isOwner && !isAdmin && !past && !cancelled && !hasRequest && plan.approval_status !== "draft";
  const canCancelNow = Boolean(onCancelNow) && isAdmin && !cancelled && !hasRequest;
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
    if ((l.action === "cancel_request" || l.action === "cancel") && l.changes.cancel_reason) return `เหตุผล: ${String(l.changes.cancel_reason.to ?? "")}`;
    const names = Object.keys(l.changes).map(k => FIELD_LABELS[k]).filter(Boolean);
    return names.length ? `แก้: ${names.join(", ")}` : "";
  }

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={plan.title}>
      <section className="modal">
        <div className="modal-head">
          <div>
            <span className="badge" style={{ background: ap.bg, color: ap.fg }}>{ap.label}</span>{" "}
            {cancelled && <span className="badge s-cancelled">ยกเลิกแล้ว</span>}
            <h2>{typeIcon(plan.work_type)} {plan.title}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="ปิด">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>

        {cancelled && <p className="warn-box"><b>แผนงานนี้ถูกยกเลิกแล้ว</b>{plan.cancel_reason ? ` · เหตุผล: ${plan.cancel_reason}` : ""}</p>}
        {expiryOf(plan) && (
          <p className="warn-box expiry-box">
            <b>{expiryLabel(expiryOf(plan)!)}</b>{" "}
            {expiryOf(plan) === "over"
              ? (isAdmin ? "แผนงานนี้ผ่านวันปฏิบัติงานไปแล้วแต่ยังไม่ได้รับอนุมัติ — ให้กด “ยกเลิกแผนงาน” ด้านล่าง" : "แผนงานนี้ผ่านวันปฏิบัติงานไปแล้วแต่ยังไม่ได้รับอนุมัติ — รอผู้ดูแลระบบยกเลิก")
              : (isAdmin ? "แผนงานนี้ยังไม่ได้รับอนุมัติ ใกล้ถึงวันปฏิบัติงานแล้ว — กดอนุมัติหรือส่งกลับ" : "แผนงานนี้ยังไม่ได้รับอนุมัติ ใกล้ถึงวันปฏิบัติงานแล้ว — โปรดแจ้งผู้ดูแลระบบ")}
          </p>
        )}
        {hasRequest && (
          <p className="warn-box">
            <b>มีคำขอยกเลิก</b> โดย {plan.cancel_requester?.full_name ?? "-"}
            {plan.cancel_requested_at ? ` เมื่อ ${fmtDateTime(plan.cancel_requested_at)}` : ""}
            {plan.cancel_reason ? ` · เหตุผล: ${plan.cancel_reason}` : ""}
          </p>
        )}
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
        <div style={{ marginBottom: 24 }}>
          <div className="muted" style={{ marginBottom: 10 }}>รถที่ใช้งาน</div>
          {vehicles.length ? <div className="chips">
            {vehicles.map((v, i) => <span className="person" key={i}>🚗 {v.code}{v.plate ? ` · ${v.plate}` : ""}</span>)}
          </div> : <span>-</span>}
        </div>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>รายละเอียด</div>
          <p className="detail-text">{plan.description ? <Linkified text={plan.description} /> : "-"}</p>
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
        {cancelling && (
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="pd-cancel">{isAdmin ? "เหตุผลที่ยกเลิก (ไม่บังคับ)" : "เหตุผลที่ขอยกเลิก (ผู้ดูแลระบบจะเป็นผู้พิจารณา)"}</label>
            <textarea id="pd-cancel" value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="เช่น งดจ่ายไฟไม่ได้ / เลื่อนไปสัปดาห์หน้า" />
            <div className="chips">
              <button className="btn danger" disabled={busy || (!isAdmin && !cancelReason.trim())}
                onClick={() => { if (isAdmin) onCancelNow?.(cancelReason.trim()); else onCancelRequest?.(cancelReason.trim()); setCancelling(false); setCancelReason(""); }}>
                {isAdmin ? "ยืนยันยกเลิกแผนงาน" : "ส่งคำขอยกเลิก"}
              </button>
              <button className="btn secondary" onClick={() => setCancelling(false)}>ไม่ยกเลิก</button>
            </div>
          </div>
        )}
        {!isAdmin && isOwner && past && !cancelled && plan.approval_status !== "draft" && (
          <p className="muted" style={{ fontSize: 13, margin: "12px 0 0" }}>งานผ่านไปแล้ว ไม่สามารถขอยกเลิกได้ หากจำเป็นให้ติดต่อผู้ดูแลระบบ</p>
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
          {canRequestCancel && !cancelling && <button className="btn secondary" disabled={busy} onClick={() => setCancelling(true)}>ขอยกเลิกแผนงาน</button>}
          {hasRequest && isOwner && !isAdmin && onCancelWithdraw && <button className="btn secondary" disabled={busy} onClick={onCancelWithdraw}>ถอนคำขอยกเลิก</button>}
          {hasRequest && isAdmin && onCancelApprove && <button className="btn danger" disabled={busy} onClick={onCancelApprove}>อนุมัติให้ยกเลิก</button>}
          {hasRequest && isAdmin && onCancelReject && <button className="btn secondary" disabled={busy} onClick={onCancelReject}>ปฏิเสธคำขอ</button>}
          {canCancelNow && !cancelling && <button className="btn secondary" disabled={busy} onClick={() => setCancelling(true)}>ยกเลิกแผนงาน</button>}
          {canDelete && <button className="btn danger" onClick={onDelete}>ลบ</button>}
        </div>
      </section>
    </div>
  );
}
