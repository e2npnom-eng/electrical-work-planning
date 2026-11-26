import { useState } from "react";
import type { createClient } from "@/lib/supabase/client";
import type { ApprovalStatus, WorkPlan } from "@/types/plan";

/** การกระทำกับแผนงาน: ส่งขออนุมัติ/อนุมัติ/ส่งกลับ, ขอยกเลิก/ยกเลิก, ลบ */
export function usePlanActions({ supabase, reloadAll, showToast, closeDetail }: {
  supabase: ReturnType<typeof createClient>; reloadAll: () => Promise<void>; showToast: (m: string) => void; closeDetail: () => void;
}) {
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return { busy, actionError, setActionError, setApproval, patchPlan, deletePlan, clearRequest };
}
