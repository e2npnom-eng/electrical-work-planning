import { expiryOf, fmtDate, fmtTime } from "@/lib/plan-meta";
import type { WorkPlan } from "@/types/plan";

/** การ์ดสรุปด้านบนหน้าแรก: จำนวนแผนงาน / กำลังดำเนินการ / รออนุมัติ-สถานะการอนุมัติของฉัน */
export function StatCards({ inSpanCount, ongoing, todo, isAdmin, onOpen }: {
  inSpanCount: number; ongoing: number; todo: WorkPlan[]; isAdmin: boolean; onOpen: (p: WorkPlan) => void;
}) {
  return (
      <div className="grid-cards">
        <div className="stat"><div><span className="muted">แผนงานในช่วงที่แสดง</span><strong>{inSpanCount} <small className="muted">แผนงาน</small></strong></div><i className="stat-ico" style={{ background: "#EDE6FA" }} aria-hidden="true">📅</i></div>
        <div className="stat"><div><span className="muted">กำลังดำเนินการ</span><strong>{ongoing} <small className="muted">แผนงาน</small></strong></div><i className="stat-ico" style={{ background: "#FFF0D6" }} aria-hidden="true">⚡</i></div>
        <div className={`stat stat-approval${todo.length ? " has-todo" : ""}`}>
          <div className="stat-body">
            <span className="muted">{isAdmin ? "รออนุมัติ / ขอยกเลิก" : "สถานะการอนุมัติของฉัน"}</span>
            {todo.slice(0, 3).map(p => {
              const kind = p.cancel_requested_at ? "cancel" : expiryOf(p) === "over" ? "over" : p.approval_status === "returned" ? "returned" : "pending";
              return (
                <button key={p.id} className={`ap-item ap-${kind}`} onClick={() => onOpen(p)}>
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
  );
}
