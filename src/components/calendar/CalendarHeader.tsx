import { APPROVALS, WORK_TYPES } from "@/lib/plan-meta";
import type { ApprovalStatus } from "@/types/plan";

type Props = {
  q: string; setQ: (v: string) => void;
  fType: string; setFType: (v: string) => void;
  fApproval: string; setFApproval: (v: string) => void;
  onlyMine: boolean; setOnlyMine: (v: boolean) => void;
  onAdd: () => void;
};

/** หัวหน้าปฏิทิน: ชื่อหน้า + ตัวกรอง + ค้นหา + ปุ่มเพิ่มแผนงาน */
export function CalendarHeader({ q, setQ, fType, setFType, fApproval, setFApproval, onlyMine, setOnlyMine, onAdd }: Props) {
  const hasFilter = Boolean(q || fType || fApproval || onlyMine);
  return (
      <div className="page-head">
        <div>
          <h1>ปฏิทินแผนงาน</h1>
          <p className="head-notes muted">เห็นแผนงานของทุกคน, แผนที่ซ้ำสถานที่หรือซ้ำคนจะมีเลขลำดับ #1 (วางก่อน) #2 ..., กดวันที่เพื่อสร้างแผนได้ทันที</p>
        </div>
        <div className="head-actions">
          <div className="filters head-filters">
            <select aria-label="ประเภทงาน" value={fType} onChange={e => setFType(e.target.value)}>
              <option value="">ทุกประเภทงาน</option>
              {WORK_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <select aria-label="สถานะอนุมัติ" value={fApproval} onChange={e => setFApproval(e.target.value)}>
              <option value="">ทุกสถานะอนุมัติ</option>
              {(Object.keys(APPROVALS) as ApprovalStatus[]).map(k => <option key={k} value={k}>{APPROVALS[k].label}</option>)}
            </select>
            {(
              <label className="check-inline"><input type="checkbox" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />เฉพาะงานของฉัน</label>
            )}
            {hasFilter && <button className="link-btn" onClick={() => { setQ(""); setFType(""); setFApproval(""); setOnlyMine(false); }}>ล้างตัวกรอง</button>}
          </div>
          <label className="head-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="search" placeholder="ค้นหาแผนงาน / สถานที่ / ชื่อคน" aria-label="ค้นหา" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <button className="btn" onClick={onAdd}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            เพิ่มแผนงาน
          </button>
        </div>
      </div>
  );
}
