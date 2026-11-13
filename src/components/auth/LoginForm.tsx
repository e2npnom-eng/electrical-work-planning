"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function employeeLoginEmail(employeeCode: string) {
  // รูปแบบเดียวกันนี้ต้องใช้ในสคริปต์ provision บัญชีพนักงาน
  return `${employeeCode.trim().toLowerCase()}@login.electrical.local`;
}

export function LoginForm() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: employeeLoginEmail(employeeCode),
      password
    });
    if (authError) {
      setLoading(false);
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบรหัสพนักงานและรหัสผ่าน");
      return;
    }
    // ไม่ปิดสถานะโหลด ให้ปุ่มค้างจนกว่าหน้าใหม่จะเปิด
    window.location.assign("/calendar");
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="employeeCode">รหัสพนักงาน</label>
        <input id="employeeCode" autoComplete="username" value={employeeCode}
          onChange={e => setEmployeeCode(e.target.value)} required placeholder="เช่น E001" />
      </div>
      <div className="field">
        <label htmlFor="password">รหัสผ่าน</label>
        <input id="password" type="password" autoComplete="current-password" value={password}
          onChange={e => setPassword(e.target.value)} required placeholder="รหัสผ่าน" />
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="btn" style={{ width: "100%", minHeight: 52, fontSize: 17 }} disabled={loading}>
        {loading ? "กำลังเข้าสู่ระบบ กรุณารอสักครู่..." : "เข้าสู่ระบบ"}
      </button>
    </form>
  );
}
