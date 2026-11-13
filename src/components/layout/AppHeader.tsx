"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EmployeeProfile } from "@/types/employee";

const svgProps = {
  width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true
};

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/calendar", label: "ปฏิทินแผนงาน",
    icon: <svg {...svgProps}><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
  },
  {
    href: "/my-schedule", label: "ตารางงานของฉัน",
    icon: <svg {...svgProps}><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5V20" /></svg>
  }
];

export function AppHeader({ profile }: { profile: EmployeeProfile }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { if (localStorage.getItem("sb-collapsed") === "1") setCollapsed(true); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty("--sb-w", collapsed ? "84px" : "264px");
  }, [collapsed]);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("sb-collapsed", next ? "1" : "0"); } catch { /* ignore */ }
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <button className="sb-toggle" onClick={toggle} aria-label={collapsed ? "ขยายเมนู" : "ย่อเมนู"}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          style={{ transform: collapsed ? "rotate(180deg)" : undefined }}>
          <path d="m15 6-6 6 6 6" />
        </svg>
      </button>

      <Link href="/calendar" className="sb-brand" title="ปฏิทินแผนงาน ผปบ.กฟจ.นครพนม">
        <span className="sb-brand-mark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12.5L13 2z" fill="currentColor" /></svg>
        </span>
        <span className="sb-label"><b>ปฏิทินแผนงาน</b><small>ผปบ.กฟจ.นครพนม</small></span>
      </Link>

      <nav className="sb-nav" aria-label="เมนูหลัก">
        <div className="sb-group">
          <div className="sb-group-title">เมนูหลัก</div>
          {NAV.map(item => (
            <Link key={item.href} href={item.href} className="sb-item" title={item.label}
              aria-current={pathname === item.href ? "page" : undefined}>
              {item.icon}<span className="sb-label">{item.label}</span>
            </Link>
          ))}
        </div>
        {profile.role === "admin" && (
          <div className="sb-group">
            <div className="sb-group-title">ผู้ดูแลระบบ</div>
            <Link href="/admin" className="sb-item" title="จัดการระบบ"
              aria-current={pathname === "/admin" ? "page" : undefined}>
              <svg {...svgProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h0a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>
              <span className="sb-label">จัดการระบบ</span>
            </Link>
          </div>
        )}
      </nav>

      <div className="sb-user">
        <div className="sb-user-row">
          <span className="sb-avatar" aria-hidden="true">{profile.full_name.charAt(0)}</span>
          <span className="sb-user-info sb-label">
            <b>{profile.full_name}</b>
            <small>{profile.employee_code} · {profile.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน"}</small>
          </span>
        </div>
        <button className="sb-logout" onClick={signOut} title="ออกจากระบบ" aria-label="ออกจากระบบ">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          <span className="sb-label">ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  );
}
