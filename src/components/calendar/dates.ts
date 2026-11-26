export const DAY = 86400000;
export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromYmd = (v: string) => { const [y, m, d] = v.split("-").map(Number); return new Date(y, m - 1, d); };
export const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const overlaps = (p: { start_at: string; end_at: string }, from: Date, to: Date) =>
  new Date(p.start_at).getTime() < to.getTime() && new Date(p.end_at).getTime() > from.getTime();
