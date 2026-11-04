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
  return <header className="topbar">
    <Link href="/calendar" className="brand">⚡ ELECTRICAL PLANNING</Link>
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 700 }}>{profile.full_name}</div>
        <div style={{ fontSize: 12, opacity: .8 }}>{profile.employee_code} · {profile.role === "admin" ? "Admin" : "Employee"}</div>
      </div>
      {profile.role === "admin" && <Link href="/admin" style={{ fontSize: 13 }}>จัดการระบบ</Link>}
      <button className="btn secondary" onClick={signOut}>ออกจากระบบ</button>
    </div>
  </header>;
}
