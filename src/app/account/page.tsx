import { AppHeader } from "@/components/layout/AppHeader";
import { ProfilePage } from "@/components/account/ProfilePage";
import { requireUser } from "@/lib/auth/requireUser";
import { createClient } from "@/lib/supabase/server";

export default async function AccountPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  // คอลัมน์ position/phone เพิ่มใน SQL 008 — ถ้ายังไม่ได้รันจะได้ค่าว่าง ไม่ทำให้หน้าพัง
  const { data } = await supabase.from("employees").select("position, phone").eq("id", profile.id).maybeSingle();
  const extra = { position: (data?.position as string | null) ?? "", phone: (data?.phone as string | null) ?? "" };
  return <>
    <AppHeader profile={profile} />
    <main className="page">
      <ProfilePage profile={profile} extra={extra} />
    </main>
  </>;
}
