import { LoginForm } from "@/components/auth/LoginForm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/calendar");

  return (
    <main className="page" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <section className="panel" style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 34 }}>⚡</div>
          <h1 style={{ margin: "8px 0" }}>ELECTRICAL PLANNING</h1>
          <p className="muted">ระบบปฏิทินแผนงานด้านไฟฟ้า</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
