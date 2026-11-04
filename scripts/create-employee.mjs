/**
 * Provision one employee account.
 * Run: node scripts/create-employee.mjs E001 "ชื่อ นามสกุล" "temporary-password" employee
 * Role: employee | admin
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.
 */
import { createClient } from "@supabase/supabase-js";

const [employeeCode, fullName, password, role = "employee"] = process.argv.slice(2);
if (!employeeCode || !fullName || !password) {
  console.error('Usage: node scripts/create-employee.mjs E001 "Full Name" "Password" [employee|admin]');
  process.exit(1);
}
if (!["employee", "admin"].includes(role)) throw new Error("Invalid role");

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const email = `${employeeCode.trim().toLowerCase()}@login.electrical.local`;
const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
if (error) throw error;

const { error: insertError } = await supabase.from("employees").insert({
  id: data.user.id, employee_code: employeeCode.trim(), full_name: fullName.trim(), role, active: true
});
if (insertError) {
  await supabase.auth.admin.deleteUser(data.user.id);
  throw insertError;
}
console.log(`Created ${employeeCode} (${role}). Ask the employee to change their temporary password after first login.`);
