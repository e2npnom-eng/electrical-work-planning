import { fmtTime } from "@/lib/plan-meta";
import type { Vehicle, WorkPlan } from "@/types/plan";
import { fromYmd, ymd } from "./dates";

export type VehicleRow = { v: Vehicle; uses: WorkPlan[] };

/** แผง "รถวันนี้ / สถานะรถ": เลือกวันที่ดูว่าคันไหนว่าง และกดที่รถเพื่อเพิ่มแผนงานด้วยรถคันนั้น */
export function VehiclePanel({ vehicles, rows, vehDate, setVehDate, onPick, onOpenPlan }: {
  vehicles: Vehicle[]; rows: VehicleRow[]; vehDate: string; setVehDate: (v: string) => void;
  onPick: (v: Vehicle, date: string) => void; onOpenPlan: (p: WorkPlan) => void;
}) {
  const vehDay = fromYmd(vehDate);
  const vehIsToday = vehDate === ymd(new Date());
  const freeVehicles = rows.filter(x => x.uses.length === 0).length;
  const dateLabel = vehDay.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const shiftVehDate = (n: number) => setVehDate(ymd(new Date(vehDay.getFullYear(), vehDay.getMonth(), vehDay.getDate() + n)));
  if (vehicles.length === 0) return null;
  return (
    <section className="panel side-panel vehicle-panel" aria-label="สถานะรถวันนี้">
            <div className="today-head">
              <h2>{vehIsToday ? "รถวันนี้" : "สถานะรถ"}</h2>
              <span className="count-pill veh-count">ว่าง {freeVehicles}/{vehicles.length}</span>
            </div>
            <div className="veh-date">
              <button type="button" className="veh-date-btn" aria-label="วันก่อนหน้า" onClick={() => shiftVehDate(-1)}>‹</button>
              <input type="date" value={vehDate} aria-label="เลือกวันที่ดูสถานะรถ"
                onChange={e => { if (e.target.value) setVehDate(e.target.value); }} />
              <button type="button" className="veh-date-btn" aria-label="วันถัดไป" onClick={() => shiftVehDate(1)}>›</button>
              {!vehIsToday && <button type="button" className="veh-date-today" onClick={() => setVehDate(ymd(new Date()))}>วันนี้</button>}
            </div>
            <p className="muted veh-date-label">{dateLabel} · กดที่รถเพื่อเพิ่มแผนงาน</p>
            <div className="veh-list">
              {rows.map(({ v, uses }) => (
                <div key={v.id} className={`veh-row ${uses.length ? "veh-busy" : "veh-free"}`} role="button" tabIndex={0}
                  title={`เพิ่มแผนงานโดยใช้รถ ${v.code}`}
                  onClick={() => onPick(v, vehDate)}
                  onKeyDown={e => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(v, vehDate); } }}>
                  <div className="veh-top">
                    <span><b>🚗 {v.code}</b>{v.plate && <small className="muted"> {v.plate}</small>}</span>
                    <span className="veh-state">{uses.length ? "ใช้งาน" : "ว่าง"}</span>
                  </div>
                  {uses.map(p => (
                    <button key={p.id} className="veh-use" onClick={e => { e.stopPropagation(); onOpenPlan(p); }}>
                      <span>{fmtTime(p.start_at)}–{fmtTime(p.end_at)}</span> {p.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </section>
  );
}
