import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { EmployeeProfile } from "@/types/employee";

export async function requireUser(): Promise<EmployeeProfile> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (user.last_sign_in_at &&
      Date.now() - new Date(user.last_sign_in_at).getTime() > 6 * 60 * 60 * 1000) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  const { data: employee, error } = await supabase.from("employees")
    .select("id, employee_code, full_name, role, active").eq("id", user.id).single();

  if (error || !employee || !employee.active) {
    await supabase.auth.signOut();
    redirect("/login");
  }
  return employee as EmployeeProfile;
}
