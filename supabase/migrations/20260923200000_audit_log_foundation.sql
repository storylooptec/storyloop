create type public.audit_event_status as enum (
  'success',
  'failed'
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  status public.audit_event_status not null default 'success',
  is_reversible boolean not null default false,
  undo_action_key text,
  duration_minutes numeric(10,2),
  created_at timestamptz not null default now()
);

create index audit_logs_company_created_at_idx
  on public.audit_logs(company_id, created_at desc);

create index audit_logs_actor_created_at_idx
  on public.audit_logs(actor_user_id, created_at desc);

create index audit_logs_entity_idx
  on public.audit_logs(company_id, entity_type, entity_id);

alter table public.audit_logs enable row level security;

grant select, insert on public.audit_logs to authenticated;

create policy "members can read audit logs"
on public.audit_logs
for select
to authenticated
using (app_private.is_company_member(company_id));

create policy "members can append own audit events"
on public.audit_logs
for insert
to authenticated
with check (
  app_private.is_company_member(company_id)
  and actor_user_id = (select auth.uid())
);

revoke update, delete on public.audit_logs from authenticated;
