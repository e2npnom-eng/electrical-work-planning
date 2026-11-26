"use client";

/** เลือกวันที่ + เวลาแบบ 24 ชั่วโมง (00:00–23:59) ไม่ขึ้นกับภาษา/การตั้งค่าของเบราว์เซอร์
 *  value / onChange ใช้รูปแบบเดียวกับ datetime-local: "YYYY-MM-DDTHH:mm" */
export function DateTime24({ id, value, onChange, required }: {
  id?: string; value: string; onChange: (v: string) => void; required?: boolean;
}) {
  const [date = "", time = ""] = value ? value.split("T") : [];
  const [hh = "", mm = ""] = time.split(":");
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const mins = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));
  if (mm && !mins.includes(mm)) { mins.push(mm); mins.sort(); }

  const emit = (d: string, h: string, m: string) => onChange(d ? `${d}T${h || "08"}:${m || "00"}` : "");

  return (
    <div className="dt24">
      <input id={id} type="date" required={required} value={date}
        onChange={e => emit(e.target.value, hh, mm)} />
      <span className="dt24-sep" aria-hidden="true" />
      <span className="dt24-time">
      <select aria-label="ชั่วโมง (24 ชม.)" value={hh || "08"} disabled={!date} onChange={e => emit(date, e.target.value, mm)}>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <span className="dt24-colon" aria-hidden="true">:</span>
      <select aria-label="นาที" value={mm || "00"} disabled={!date} onChange={e => emit(date, hh, e.target.value)}>
        {mins.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      </span>
    </div>
  );
}
