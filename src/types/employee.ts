export type EmployeeRole = "admin" | "employee";
export type EmployeeProfile = {
  id: string;
  employee_code: string;
  full_name: string;
  role: EmployeeRole;
  active: boolean;
};
