"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { EmployeeProfile } from "@/types/employee";

export function AppHeader({ profile }: { profile: EmployeeProfile }) {
  const router = useRouter();
  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <header className="topbar">
      <Link href="/calendar" className="brand">
        <span className="brand-mark" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12.5L13 2z" fill="currentColor" /></svg>
        </span>
        <span className="brand-name">ปฏิทินแผนงาน ผปบ.กฟจ.นครพนม</span>
      </Link>
      <div className="topbar-right">
        <div className="user-block">
          <div className="user-name">{profile.full_name}</div>
          <div className="user-meta">{profile.employee_code} · {profile.role === "admin" ? "ผู้ดูแลระบบ" : "พนักงาน"}</div>
        </div>
        {profile.role === "admin" && <Link href="/admin" className="topbar-link">จัดการระบบ</Link>}
        <button className="topbar-btn" onClick={signOut}>ออกจากระบบ</button>
      </div>
    </header>
  );
}
