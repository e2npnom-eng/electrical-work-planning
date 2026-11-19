import { redirect } from "next/navigation";

// หน้าแรก: ส่งไปปฏิทิน (ถ้ายังไม่ล็อกอิน ระบบจะพาไปหน้าเข้าสู่ระบบเอง)
export default function Home() {
  redirect("/calendar");
}
