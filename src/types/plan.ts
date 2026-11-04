export type WorkPlanStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type WorkPlanMember = {
  employee_id: string;
  employee?: { id: string; full_name: string; employee_code: string };
};
export type WorkPlan = {
  id: string;
  title: string;
  controller_id: string;
  controller?: { id: string; full_name: string; employee_code: string };
  creator?: { id: string; full_name: string; employee_code: string };
  created_by: string;
  location: string;
  start_at: string;
  end_at: string;
  work_type: string | null;
  description: string | null;
  status: WorkPlanStatus;
  work_plan_members?: WorkPlanMember[];
};
