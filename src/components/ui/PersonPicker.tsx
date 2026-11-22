"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

export type PickerOption = { value: string; label: string; sub?: string; pinned?: boolean };

/** ตัวเลือกพนักงานแบบพิมพ์ค้นหาได้ (ชื่อหรือรหัส) ใช้ได้ทั้งเมาส์ คีย์บอร์ด และมือถือ */
export function PersonPicker({ value, onChange, options, id, ariaLabel, className }: {
  value: string; onChange: (v: string) => void; options: PickerOption[];
  id?: string; ariaLabel?: string; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();

  const current = options.find(o => o.value === value);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(() => needle
    ? options.filter(o => o.label.toLowerCase().includes(needle) || (o.sub ?? "").toLowerCase().includes(needle))
    : options, [options, needle]);
  const pinned = shown.filter(o => o.pinned);
  const others = shown.filter(o => !o.pinned);
  const flat = [...pinned, ...others];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc); document.addEventListener("touchstart", onDoc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("touchstart", onDoc); };
  }, [open]);

  useEffect(() => {
    if (open) { setQ(""); setActive(Math.max(flat.findIndex(o => o.value === value), 0)); setTimeout(() => input.current?.focus(), 0); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { setActive(0); }, [needle]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(o: PickerOption) { onChange(o.value); setOpen(false); }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(i => Math.min(i + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (flat[active]) pick(flat[active]); }
    else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
  }

  const row = (o: PickerOption, i: number) => (
    <li key={o.value} data-i={i} role="option" aria-selected={o.value === value}
      className={`pp-opt${i === active ? " is-active" : ""}${o.value === value ? " is-selected" : ""}`}
      onMouseEnter={() => setActive(i)} onClick={() => pick(o)}>
      <span className="pp-av" aria-hidden="true">{o.label.replace(/^(นาย|นางสาว|นาง)/, "").trim().charAt(0) || "•"}</span>
      <span className="pp-txt"><b>{o.label}</b>{o.sub && <small>{o.sub}</small>}</span>
      {o.value === value && <span className="pp-check" aria-hidden="true">✓</span>}
    </li>
  );

  return (
    <div className={`pp${className ? ` ${className}` : ""}`} ref={root}>
      <button type="button" id={id} className="pp-btn" aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}>
        <span className="pp-cur">{current ? current.label : "เลือกพนักงาน"}{current?.sub && <small>{current.sub}</small>}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="pp-pop">
          <div className="pp-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <input ref={input} type="search" placeholder="พิมพ์ชื่อหรือรหัสพนักงาน" aria-label="ค้นหาพนักงาน" role="combobox" aria-expanded="true" aria-controls={listId}
              value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} autoComplete="off" />
          </div>
          <ul ref={list} id={listId} role="listbox" className="pp-list">
            {flat.length === 0 && <li className="pp-empty">ไม่พบรายชื่อที่ค้นหา</li>}
            {pinned.map((o, i) => row(o, i))}
            {pinned.length > 0 && others.length > 0 && <li className="pp-sep" role="presentation">พนักงาน ({others.length} คน)</li>}
            {others.map((o, i) => row(o, pinned.length + i))}
          </ul>
        </div>
      )}
    </div>
  );
}
