-- Electrical Work Planning: Phase 1 schema
create extension if not exists pgcrypto;

create table public.employees (
  id uuid primary key references auth.users(id) on delete cascade,
  employee_code text not null unique,
  full_name text not null,
  role text not null default 'employee' check (role in ('admin','employee')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  team_name text not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  primary key (team_id, employee_id)
);

create table public.work_plans (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  controller_id uuid not null references public.employees(id),
  location text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  work_type text,
  description text,
  status text not null default 'planned'
    check (status in ('planned','in_progress','completed','cancelled')),
  created_by uuid not null references public.employees(id),
  updated_by uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_work_plan_time check (end_at > start_at)
);

create table public.work_plan_members (
  work_plan_id uuid not null references public.work_plans(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  primary key (work_plan_id, employee_id)
);

create index work_plans_start_at_idx on public.work_plans(start_at);
create index work_plans_end_at_idx on public.work_plans(end_at);
create index work_plans_controller_idx on public.work_plans(controller_id);
create index work_plans_created_by_idx on public.work_plans(created_by);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employees
    where id = auth.uid() and role = 'admin' and active = true
  );
$$;

create or replace function public.set_updated_fields()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger work_plans_set_updated
before update on public.work_plans
for each row execute function public.set_updated_fields();

alter table public.employees enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.work_plans enable row level security;
alter table public.work_plan_members enable row level security;

-- Authenticated users can see the active employee directory for assignment and calendar display.
create policy "employees_read_authenticated"
on public.employees for select to authenticated
using (active = true or public.is_admin());

create policy "employees_admin_manage"
on public.employees for all to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "teams_read_authenticated"
on public.teams for select to authenticated using (true);
create policy "teams_admin_manage"
on public.teams for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "team_members_read_authenticated"
on public.team_members for select to authenticated using (true);
create policy "team_members_admin_manage"
on public.team_members for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "work_plans_read_authenticated"
on public.work_plans for select to authenticated using (true);
create policy "work_plans_insert_own"
on public.work_plans for insert to authenticated
with check (created_by = auth.uid());
create policy "work_plans_update_owner_or_admin"
on public.work_plans for update to authenticated
using (created_by = auth.uid() or public.is_admin())
with check (created_by = auth.uid() or public.is_admin());
create policy "work_plans_delete_admin"
on public.work_plans for delete to authenticated
using (public.is_admin());

create policy "work_plan_members_read_authenticated"
on public.work_plan_members for select to authenticated using (true);
create policy "work_plan_members_insert_owner_or_admin"
on public.work_plan_members for insert to authenticated
with check (
  exists (
    select 1 from public.work_plans p
    where p.id = work_plan_id
      and (p.created_by = auth.uid() or public.is_admin())
  )
);
create policy "work_plan_members_delete_owner_or_admin"
on public.work_plan_members for delete to authenticated
using (
  exists (
    select 1 from public.work_plans p
    where p.id = work_plan_id
      and (p.created_by = auth.uid() or public.is_admin())
  )
);

-- Realtime publication: publish changes so subscribed calendars refresh.
alter publication supabase_realtime add table public.work_plans;
alter publication supabase_realtime add table public.work_plan_members;
