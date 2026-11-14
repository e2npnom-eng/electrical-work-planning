export type Role = "admin" | "executive" | "employee";

export type EmployeeProfile = {
  id: string;
  employee_code: string;
  full_name: string;
  role: Role;
  active?: boolean;
};
