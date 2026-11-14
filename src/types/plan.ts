export type WorkStatus = "planned" | "in_progress" | "completed" | "cancelled";
export type ApprovalStatus = "draft" | "pending" | "approved" | "returned";

export type PersonRef = { id: string; full_name: string; employee_code: string };

export type WorkPlan = {
  id: string;
  title: string;
  controller_id: string;
  location: string;
  start_at: string;
  end_at: string;
  work_type: string | null;
  description: string | null;
  status: WorkStatus;
  created_by: string;
  approval_status: ApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  review_note: string | null;
  recurrence_group: string | null;
  created_at?: string;
  updated_at?: string | null;
  controller?: PersonRef | null;
  creator?: PersonRef | null;
  approver?: PersonRef | null;
  work_plan_members?: { employee_id: string; employee?: PersonRef | null }[];
};

export type Conflict = {
  plan_id: string;
  title: string;
  start_at: string;
  end_at: string;
  person_id: string;
  person_name: string;
};
