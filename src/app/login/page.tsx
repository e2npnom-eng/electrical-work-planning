import { LoginForm } from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// สีตัวอย่างตรงกับปฏิทินหน้าแรก: อนุมัติแล้ว (เขียว) / รออนุมัติ (ส้ม) / ร่าง (เทา)
const week = [
  { d: "จ.", chips: [["ตรวจสอบ", "a-approved"]] },
  { d: "อ.", chips: [["บำรุงรักษา", "a-approved"], ["ก่อสร้าง", "a-pending"]] },
  { d: "พ.", chips: [["แก้ไขเหตุขัดข้อง", "a-pending"]] },
  { d: "พฤ.", chips: [["ตรวจสอบ", "a-draft"]] },
  { d: "ศ.", chips: [["บำรุงรักษา", "a-approved"], ["ก่อสร้าง", "a-draft"]] }
];

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/calendar");

  return (
    <div className="login-shell">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24"><path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12.5L13 2z" fill="currentColor" /></svg>
          </span>
          <span style={{ fontSize: 17, fontWeight: 600 }}>ผปบ.กฟจ.นครพนม</span>
        </div>
        <div>
          <h2>ทุกแผนงานไฟฟ้าของแผนก อยู่ในปฏิทินเดียว</h2>
          <p>ดูงานของทั้งทีม วางแผนล่วงหน้า และอัปเดตสถานะได้ทันที</p>
          <div className="hero-week" aria-hidden="true">
            {week.map(col => (
              <div className="hero-day" key={col.d}>
                <small>{col.d}</small>
                {col.chips.map(([t, s], i) => <span key={i} className={`hero-chip ${s}`}>{t}</span>)}
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,.72)" }}>สำหรับเจ้าหน้าที่ ผปบ.กฟจ.นครพนม</p>
      </section>
      <main className="login-main">
        <div className="login-card">
          <h1>เข้าสู่ระบบ</h1>
          <p className="muted" style={{ margin: "0 0 32px" }}>กรอกรหัสพนักงานและรหัสผ่านของคุณ</p>
          <LoginForm />
          <p className="muted" style={{ marginTop: 24 }}>ลืมรหัสผ่าน? แจ้งผู้ดูแลระบบเพื่อตั้งรหัสผ่านใหม่</p>
        </div>
      </main>
    </div>
  );
}
